#!/usr/bin/env bash
set -euo pipefail

PK="$1"
if [ -z "$PK" ]; then
  echo "Usage: $0 <private-key>"
  exit 1
fi

AMOUNT="0.01ether"
RPC="https://evmrpc-testnet.0g.ai"

# Hardcoded keys from seed.js
KEYS=(
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"
)

for key in "${KEYS[@]}"; do
  ADDR=$(cast wallet address --private-key "$key")
  echo "Funding $ADDR..."
  cast send "$ADDR" --value "$AMOUNT" --private-key "$PK" --rpc-url "$RPC" --legacy
  sleep 5
done
