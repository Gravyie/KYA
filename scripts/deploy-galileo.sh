#!/usr/bin/env bash
# Deploy KYA to 0G Galileo testnet and write deployments/16602.json.
set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env
if [ -f .env ]; then
  source .env
fi

# Use the keys from .env, or fallback to the provided one
DEPLOYER_PK=${PRIVATE_KEY}
ATTESTOR_PK=${ATTESTOR_PRIVATE_KEY}
EXECUTOR_PK=${EXECUTOR_PRIVATE_KEY}

ATTESTOR_ADDR=$(cast wallet address --private-key "$ATTESTOR_PK")
EXECUTOR_ADDR=$(cast wallet address --private-key "$EXECUTOR_PK")

echo "attestor  $ATTESTOR_ADDR"
echo "executor  $EXECUTOR_ADDR"

mkdir -p deployments

(
  cd contracts
  PRIVATE_KEY="$DEPLOYER_PK" \
  ATTESTOR_ADDR="$ATTESTOR_ADDR" \
  EXECUTOR_ADDR="$EXECUTOR_ADDR" \
  PARENT_NAME="${PARENT_NAME:-kya.eth}" \
  forge script script/Deploy.s.sol:Deploy \
    --rpc-url "https://evmrpc-testnet.0g.ai" \
    --broadcast \
    --legacy \
    -q
)

cp contracts/deployments/16602.json deployments/16602.json

echo
cat deployments/16602.json
