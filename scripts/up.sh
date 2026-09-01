#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KYA — one command to a demo-ready stack.
#
#   bash scripts/up.sh              full reset: chain, deploy, seed, api, web
#   bash scripts/up.sh --no-seed    keep existing chain state
#   bash scripts/up.sh --verify     run the 51-check e2e gate and exit
#
# Idempotent: kills anything already holding the ports, so re-running before a
# rehearsal is safe. Every step is checked — if the chain never comes up or the
# seed fails, this exits non-zero rather than leaving a half-built stack that
# fails on stage instead.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

ANVIL_PORT=8545
API_PORT=${PORT:-5055}
WEB_PORT=5173
LOG_DIR="$ROOT/.logs"
SEED=1
VERIFY_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --no-seed) SEED=0 ;;
    --verify) VERIFY_ONLY=1 ;;
    *) echo "unknown flag: $arg" && exit 2 ;;
  esac
done

b() { printf '\033[1m%s\033[0m\n' "$1"; }
dim() { printf '\033[2m%s\033[0m\n' "$1"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
die() { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

mkdir -p "$LOG_DIR"

if [ "$VERIFY_ONLY" = "1" ]; then
  exec node scripts/verify-e2e.mjs
fi

# ── preflight ────────────────────────────────────────────────────────────────
b "KYA — bringing up the stack"
for cmd in anvil forge cast node pnpm; do
  command -v "$cmd" >/dev/null 2>&1 || die "$cmd not found on PATH"
done
ok "toolchain present"

# ── free the ports ───────────────────────────────────────────────────────────
for port in $ANVIL_PORT $API_PORT $WEB_PORT; do
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    dim "  freed port $port"
  fi
done
sleep 1

# ── chain ────────────────────────────────────────────────────────────────────
# No --block-time: instant mining. With a block time every waitForTransaction
# stalls for a block, which turned a 147-receipt seed into minutes.
#
# Each long-lived process is fully detached: stdin from /dev/null, stdout and
# stderr to a log, then disowned. Without closing the inherited stdout a child
# keeps this script's pipe open, so a caller that pipes `up.sh` into anything
# (or a CI wrapper with a timeout) hangs forever waiting for EOF on a stack that
# is actually running fine.
nohup anvil --host 127.0.0.1 --port $ANVIL_PORT --chain-id 31337 --silent \
  </dev/null > "$LOG_DIR/anvil.log" 2>&1 &
ANVIL_PID=$!
disown $ANVIL_PID 2>/dev/null || true

for i in $(seq 1 40); do
  if cast block-number --rpc-url "http://127.0.0.1:$ANVIL_PORT" >/dev/null 2>&1; then break; fi
  sleep 0.25
  [ "$i" = "40" ] && die "anvil did not come up — see $LOG_DIR/anvil.log"
done
ok "anvil on :$ANVIL_PORT (pid $ANVIL_PID)"

# ── contracts ────────────────────────────────────────────────────────────────
forge build --root contracts -q 2>/dev/null || die "forge build failed"
ok "contracts compiled"

bash scripts/deploy-local.sh > "$LOG_DIR/deploy.log" 2>&1 || die "deploy failed — see $LOG_DIR/deploy.log"
REGISTRY=$(node -e "console.log(require('$ROOT/deployments/31337.json').contracts.PassportRegistry)")
ok "deployed · registry $REGISTRY"

node scripts/sync-abi.mjs > /dev/null || die "abi sync failed"
ok "ABIs synced to the SDK"

# ── seed ─────────────────────────────────────────────────────────────────────
if [ "$SEED" = "1" ]; then
  rm -rf apps/api/data
  pnpm seed > "$LOG_DIR/seed.log" 2>&1 || die "seed failed — see $LOG_DIR/seed.log"
  tail -5 "$LOG_DIR/seed.log" | sed 's/^/  /'
  ok "demo cast seeded"
fi

# ── api ──────────────────────────────────────────────────────────────────────
nohup node apps/api/src/server.js </dev/null > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!
disown $API_PID 2>/dev/null || true
for i in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then break; fi
  sleep 0.25
  [ "$i" = "40" ] && die "api did not come up — see $LOG_DIR/api.log"
done
ok "api on :$API_PORT (pid $API_PID)"

# ── web ──────────────────────────────────────────────────────────────────────
(cd apps/web && nohup pnpm exec vite --host 127.0.0.1 --port $WEB_PORT \
  </dev/null > "$LOG_DIR/web.log" 2>&1 & disown) 
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$WEB_PORT/" >/dev/null 2>&1; then break; fi
  sleep 0.25
  [ "$i" = "60" ] && die "web did not come up — see $LOG_DIR/web.log"
done
ok "web on :$WEB_PORT"

# ── prove it ─────────────────────────────────────────────────────────────────
echo
b "Verifying end to end"
if node scripts/verify-e2e.mjs; then
  echo
  b "Ready"
  echo "  demo          http://127.0.0.1:$WEB_PORT/#/compare"
  echo "  api           http://127.0.0.1:$API_PORT/health"
  echo "  logs          $LOG_DIR/"
  echo
  dim "  stop with: bash scripts/down.sh"
else
  die "end-to-end verification failed — do NOT demo this build"
fi
