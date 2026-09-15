#!/usr/bin/env bash
#
# Build and deploy apex_protocol to Solana devnet from WSL.
#
# Windows cannot run `cargo build-sbf`: installing Solana platform-tools needs
# the symlink privilege and fails with os error 1314 unless Developer Mode is
# on. WSL has no such restriction, so the build and deploy run here.
#
# Usage:
#   bash scripts/deploy-devnet.sh build      # compile the SBF artifact only
#   bash scripts/deploy-devnet.sh fund       # try to top up devnet SOL
#   bash scripts/deploy-devnet.sh deploy     # build if needed, then deploy
#   bash scripts/deploy-devnet.sh status     # show wallet, program, and costs

set -euo pipefail

# WSL inherits a Windows-style HOME through interop, which breaks cargo and
# solana. Pin it, and keep PATH free of the Windows entries whose parentheses
# break shell expansion.
export HOME="${HOME_OVERRIDE:-/home/$(id -un)}"
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:/usr/local/bin:/usr/bin:/bin"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The program is built in a Linux-side staging copy rather than in place on
# /mnt/c, for two reasons:
#   1. A Windows-side rust-analyzer re-resolves Cargo.lock to v4 mid-build,
#      racing the v3 rewrite the Solana toolchain needs.
#   2. Compiling on the 9p /mnt/c mount is markedly slower.
STAGE_DIR="${STAGE_DIR:-$HOME/.cache/apex-build}"
SO_PATH="$STAGE_DIR/target/deploy/apex_protocol.so"
PROGRAM_KEYPAIR="$PROJECT_DIR/target/deploy/apex_protocol-keypair.json"
CLUSTER="${CLUSTER:-https://api.devnet.solana.com}"

log()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
fail() { printf '\n\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

require_tools() {
  command -v cargo   >/dev/null || fail "cargo not found in PATH"
  command -v solana  >/dev/null || fail "solana not found in PATH"
}

# The Solana toolchain bundles an older Rust that cannot read a v4 lockfile,
# which is what recent cargo on Windows writes. Rewrite the header to v3.
normalize_lockfile() {
  local lock="$1"
  [[ -f "$lock" ]] || return 0
  if head -5 "$lock" | grep -q '^version = 4'; then
    info "rewriting Cargo.lock header v4 -> v3 for platform-tools"
    sed -i '0,/^version = 4/s/^version = 4/version = 3/' "$lock"
  fi
}

# Copies just what cargo needs to build the program into the staging dir.
sync_stage() {
  mkdir -p "$STAGE_DIR/target/deploy"
  cp -f "$PROJECT_DIR/Cargo.toml" "$STAGE_DIR/Cargo.toml"
  cp -f "$PROJECT_DIR/Cargo.lock" "$STAGE_DIR/Cargo.lock"
  [[ -f "$PROJECT_DIR/Anchor.toml" ]] && cp -f "$PROJECT_DIR/Anchor.toml" "$STAGE_DIR/Anchor.toml"

  rm -rf "$STAGE_DIR/programs"
  mkdir -p "$STAGE_DIR/programs"
  cp -r "$PROJECT_DIR/programs/." "$STAGE_DIR/programs/"

  # Reuse the committed program keypair so the deployed address keeps matching
  # declare_id!() across rebuilds.
  if [[ -f "$PROGRAM_KEYPAIR" ]]; then
    cp -f "$PROGRAM_KEYPAIR" "$STAGE_DIR/target/deploy/apex_protocol-keypair.json"
  fi

  normalize_lockfile "$STAGE_DIR/Cargo.lock"
}

do_build() {
  require_tools
  log "Staging sources at $STAGE_DIR"
  sync_stage
  log "Building SBF artifact"
  ( cd "$STAGE_DIR" && cargo build-sbf )
  [[ -f "$SO_PATH" ]] || fail "build reported success but $SO_PATH is missing"
  info "artifact: $SO_PATH ($(stat -c%s "$SO_PATH") bytes)"
}

do_status() {
  require_tools
  local program_id balance size rent
  program_id="$(solana-keygen pubkey "$PROGRAM_KEYPAIR" 2>/dev/null || echo '<no keypair>')"

  log "Wallet"
  info "address: $(solana address)"
  balance="$(solana balance --url "$CLUSTER" | awk '{print $1}')"
  info "balance: $balance SOL"

  log "Program"
  info "id: $program_id"
  if [[ -f "$SO_PATH" ]]; then
    size="$(stat -c%s "$SO_PATH")"
    rent="$(solana rent "$size" --url "$CLUSTER" | awk '/Rent-exempt/ {print $3}')"
    info "artifact size: $size bytes"
    info "program data rent: $rent SOL"
    # A fresh deploy holds the buffer and the program data account at the same
    # time, so peak requirement is roughly twice the rent. The buffer is closed
    # and refunded afterwards.
    info "peak SOL needed for a fresh deploy: ~$(awk "BEGIN{printf \"%.2f\", $rent * 2 + 0.05}")"
  else
    info "artifact: not built yet"
  fi

  log "On-chain state"
  solana program show "$program_id" --url "$CLUSTER" 2>&1 | head -12 || true
}

do_fund() {
  require_tools
  log "Requesting devnet SOL"
  local before after
  before="$(solana balance --url "$CLUSTER" | awk '{print $1}')"
  info "before: $before SOL"

  # The public faucet is aggressively rate limited per IP. Try a few smaller
  # requests rather than one large one, and never treat failure as fatal.
  local i
  for i in 1 2 3 4 5 6; do
    if solana airdrop 2 --url "$CLUSTER" >/dev/null 2>&1; then
      info "airdrop $i: ok"
    else
      info "airdrop $i: rate limited or refused"
    fi
    sleep 4
  done

  after="$(solana balance --url "$CLUSTER" | awk '{print $1}')"
  info "after: $after SOL"

  if [[ "$before" == "$after" ]]; then
    cat <<'EOF'

  The CLI faucet is rate limited right now. Options:
    1. Wait and re-run: bash scripts/deploy-devnet.sh fund
    2. Use the web faucet (has a captcha): https://faucet.solana.com
       Paste the wallet address printed by `status`.
    3. Point CLUSTER at an RPC provider whose faucet you have access to:
       CLUSTER=https://your-devnet-rpc bash scripts/deploy-devnet.sh fund
EOF
  fi
}

do_deploy() {
  require_tools
  [[ -f "$SO_PATH" ]] || do_build
  [[ -f "$PROGRAM_KEYPAIR" ]] || fail "missing program keypair at $PROGRAM_KEYPAIR"

  local declared keypair_id size rent balance needed
  declared="$(grep -oP 'declare_id!\("\K[^"]+' "$PROJECT_DIR/programs/apex_protocol/src/lib.rs")"
  keypair_id="$(solana-keygen pubkey "$PROGRAM_KEYPAIR")"
  [[ "$declared" == "$keypair_id" ]] \
    || fail "declare_id ($declared) does not match the deploy keypair ($keypair_id)"

  size="$(stat -c%s "$SO_PATH")"
  rent="$(solana rent "$size" --url "$CLUSTER" | awk '/Rent-exempt/ {print $3}')"
  balance="$(solana balance --url "$CLUSTER" | awk '{print $1}')"
  needed="$(awk "BEGIN{printf \"%.4f\", $rent * 2 + 0.05}")"

  log "Deploy plan"
  info "cluster: $CLUSTER"
  info "program: $keypair_id"
  info "size:    $size bytes"
  info "balance: $balance SOL / need ~$needed SOL at peak"

  if awk "BEGIN{exit !($balance < $needed)}"; then
    fail "insufficient SOL. Run: bash scripts/deploy-devnet.sh fund"
  fi

  log "Deploying"
  solana program deploy "$SO_PATH" \
    --program-id "$PROGRAM_KEYPAIR" \
    --url "$CLUSTER"

  log "Deployed"
  solana program show "$keypair_id" --url "$CLUSTER" | head -12
}

case "${1:-status}" in
  build)  do_build ;;
  fund)   do_fund ;;
  deploy) do_deploy ;;
  status) do_status ;;
  *) fail "unknown command '${1}'. Use build | fund | deploy | status" ;;
esac
