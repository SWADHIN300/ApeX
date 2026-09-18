#!/usr/bin/env bash
#
# complete-deploy.sh — finishes ApeX devnet provisioning on a flaky RPC.
#
#   1. gets the fixed mock_oracle onto devnet (tries upgrade in place, then a
#      fresh deploy to a new Program ID if upg reads keep timing out)
#   2. runs scripts/provision-devnet.js to create the oracle feed + market
#
# Run from WSL:   bash scripts/complete-deploy.sh [price_usd]
set -uo pipefail
export HOME=/home/$(id -un)
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:/usr/local/bin:/usr/bin:/bin"

CLUSTER=${CLUSTER:-https://api.devnet.solana.com}
PROJECT=/mnt/c/Users/swadh/APEX
WINPROJ="C:\\Users\\swadh\\APEX"
STAGE="$HOME/.cache/apex-build"
KEY="$STAGE/target/deploy/mock_oracle-keypair.json"
SO="$STAGE/target/deploy/mock_oracle.so"
DKEY="$HOME/.config/solana/apex-fresh-deploy.json"
NODE="/mnt/c/Program Files/nodejs/node.exe"
PRICE_USD="${1:-60000}"

log() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# reliable program write: write-buffer then deploy-from-buffer
write_and_deploy() {          # $1=so  $2=program-keypair  ($3=optional existing target id)
  local so="$1" kp="$2" buf
  for t in 1 2 3 4 5; do
    buf=$(solana program write-buffer "$so" --url "$CLUSTER" 2>/dev/null | grep -oE "^[A-Za-z0-9]{40,44}" | tail -1)
    [ -n "$buf" ] && break
    sleep 4
  done
  [ -z "$buf" ] && return 1
  local out
  out=$(timeout 180 solana program deploy --program-id "$kp" --buffer "$buf" --url "$CLUSTER" 2>&1)
  solana program close "$buf" --url "$CLUSTER" >/dev/null 2>&1 || true
  printf '%s' "$out" >/dev/null
  return 0
}

clean_buffers() {
  for b in $(solana program show --buffers --url "$CLUSTER" 2>/dev/null | grep -oE "^[A-Za-z0-9]{40,44}"); do
    solana program close "$b" --url "$CLUSTER" >/dev/null 2>&1 || true
  done
}

# ---------- 1) make sure the fixed mock_oracle is on devnet ----------
MOCK_ID="$(solana-keygen pubkey "$KEY" 2>/dev/null || echo '')"
log "mock_oracle keypair ID: ${MOCK_ID:-<none>}"

# 1a) try upgrade in place
got_new=""
for round in $(seq 1 15); do
  # is a fixed (45KB) binary already live at this ID?
  if [ -n "$MOCK_ID" ]; then
    DL=$(solana program show "$MOCK_ID" --url "$CLUSTER" 2>/dev/null | grep -oE "Data Length: [0-9]+")
    echo "  [$round] $DL"
    echo "$DL" | grep -q "45600" && { got_new="$MOCK_ID"; break; }
  fi
  clean_buffers
  write_and_deploy "$SO" "$KEY" && { sleep 3; got_new="$(solana-keygen pubkey "$KEY")"; }
  sleep 4
done

# 1b) fallback: fresh deploy to a NEW Program ID
if [ -z "$got_new" ]; then
  log "Upgrade resisted; fresh-deploying mock_oracle to a new ID"
  FRESH="$HOME/.cache/mock_alt.json"
  solana-keygen new --outfile "$FRESH" --no-bip39-passphrase --force >/dev/null 2>&1
  FRESH_ID="$(solana-keygen pubkey "$FRESH")"
  cp "$FRESH" "$PROJECT/target/deploy/mock_oracle-keypair.json"
  for round in $(seq 1 15); do
    clean_buffers
    if write_and_deploy "$SO" "$FRESH"; then
      sleep 3
      DL=$(solana program show "$FRESH_ID" --url "$CLUSTER" 2>/dev/null | grep -oE "Data Length: [0-9]+")
      echo "  fresh [$round] $DL"
      echo "$DL" | grep -q "45600" && { got_new="$FRESH_ID"; break; }
    fi
    sleep 4
  done
fi

if [ -z "$got_new" ]; then
  log "FAILED: could not get fixed mock_oracle onto devnet (RPC rejecting program writes)."
  log "Re-run:  bash scripts/complete-deploy.sh"
  exit 1
fi
log "mock_oracle live at $got_new"
cp "$KEY" "$PROJECT/target/deploy/mock_oracle-keypair.json" 2>/dev/null || true

# ---------- 2) provision feed + market ----------
# point the provisioner at the actual mock_oracle id
if [ -f "$PROJECT/provisioned.json" ]; then
  sed -i "s#\"mockOracleProgram\": *\"[A-Za-z0-9]*\"#\"mockOracleProgram\": \"$got_new\"#" "$PROJECT/provisioned.json"
fi

log "Provisioning feed + market (idempotent)"
printf '%s' "$(cat "$DKEY")" > "$PROJECT/.tmp-deploy.json"
"$NODE" "$WINPROJ\\scripts\\provision-devnet.js" "$WINPROJ\\.tmp-deploy.json" "$PRICE_USD"
STATUS=$?
rm -f "$PROJECT/.tmp-deploy.json"
log "Done (status $STATUS). See provisioned.json for addresses."
exit $STATUS