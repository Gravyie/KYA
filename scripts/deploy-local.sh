#!/usr/bin/env bash
# Deploy KYA to the local anvil chain and write deployments/31337.json.
set -euo pipefail
cd "$(dirname "$0")/.."

# anvil's deterministic accounts. Distinct roles, distinct keys.
DEPLOYER_PK=${DEPLOYER_PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}
ATTESTOR_PK=${ATTESTOR_PK:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}
EXECUTOR_PK=${EXECUTOR_PK:-0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a}
OWNER_PK=${OWNER_PK:-0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6}

ATTESTOR_ADDR=$(cast wallet address --private-key "$ATTESTOR_PK")
EXECUTOR_ADDR=$(cast wallet address --private-key "$EXECUTOR_PK")
OWNER_ADDR=$(cast wallet address --private-key "$OWNER_PK")

echo "attestor  $ATTESTOR_ADDR"
echo "executor  $EXECUTOR_ADDR"
echo "owner     $OWNER_ADDR"

mkdir -p deployments

(
  cd contracts
  PRIVATE_KEY="$DEPLOYER_PK" \
  ATTESTOR_ADDR="$ATTESTOR_ADDR" \
  EXECUTOR_ADDR="$EXECUTOR_ADDR" \
  PARENT_NAME="${PARENT_NAME:-kya.eth}" \
  forge script script/Deploy.s.sol:Deploy \
    --rpc-url "${RPC_URL:-http://127.0.0.1:8545}" \
    --broadcast \
    -q
)

# forge resolves fs paths relative to the project root, so lift the address book
# up to the workspace-level deployments/ dir that SDK, API and web all read.
cp contracts/deployments/31337.json deployments/31337.json

echo
cat deployments/31337.json

# Write a .env the API and web app both read, unless one already exists.
if [ ! -f .env ]; then
  cat > .env <<EOF
CHAIN_ID=31337
RPC_URL=http://127.0.0.1:8545
PORT=5055

ATTESTOR_PRIVATE_KEY=$ATTESTOR_PK
EXECUTOR_PRIVATE_KEY=$EXECUTOR_PK
OWNER_PRIVATE_KEY=$OWNER_PK
PRIVATE_KEY=$DEPLOYER_PK

# World ID — set WORLD_APP_ID (app_... or rp_...) to switch from the local
# stand-in to real cloud verification.
# WORLD_APP_ID=
WORLD_ACTION=kya-verify-owner

# 0G Compute Router — set OG_COMPUTE_API_KEY to execute tasks on live 0G.
# OG_COMPUTE_API_KEY=
OG_COMPUTE_MODEL=gpt-oss-120b
OG_VERIFY_TEE=true
EOF
  echo
  echo "wrote .env"
fi
