#!/usr/bin/env bash
#
# Locate the keypair file matching a given public key.
#
# Prints only file paths and derived public keys — never secret key material.
#
# Usage: bash scripts/find-keypair.sh <PUBKEY>

set -uo pipefail

export HOME="${HOME_OVERRIDE:-/home/$(id -un)}"
export PATH="$HOME/.local/share/solana/install/active_release/bin:/usr/local/bin:/usr/bin:/bin"

TARGET="${1:-}"
[[ -n "$TARGET" ]] || { echo "usage: $0 <PUBKEY>" >&2; exit 1; }

echo "Searching for keypair matching: $TARGET"

# Directories most likely to hold Solana keypairs, on both the Linux and the
# mounted Windows side.
SEARCH_DIRS=(
  "$HOME/.config/solana"
  "$HOME/.solana"
  "/mnt/c/Users/swadh/.config/solana"
  "/mnt/c/Users/swadh/APEX"
  "/mnt/c/Users/swadh/Secret"
  "/mnt/c/Users/swadh/Downloads"
)

found=0
for dir in "${SEARCH_DIRS[@]}"; do
  [[ -d "$dir" ]] || continue
  while IFS= read -r -d '' file; do
    # Only consider files that look like a 64-byte secret key array.
    head -c 1 "$file" 2>/dev/null | grep -q '\[' || continue
    pubkey="$(solana-keygen pubkey "$file" 2>/dev/null)" || continue
    [[ -n "$pubkey" ]] || continue
    if [[ "$pubkey" == "$TARGET" ]]; then
      echo "  MATCH: $file"
      found=1
    else
      echo "  (no)   $file -> $pubkey"
    fi
  done < <(find "$dir" -maxdepth 3 -name '*.json' -type f -print0 2>/dev/null)
done

if [[ "$found" -eq 0 ]]; then
  echo
  echo "No local keypair matches $TARGET."
  echo "Deploying from that wallet requires its private key on this machine."
fi
