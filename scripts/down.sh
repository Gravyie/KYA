#!/usr/bin/env bash
# Stop everything scripts/up.sh started.
set -uo pipefail
cd "$(dirname "$0")/.."

for port in 8545 ${PORT:-5055} 5173; do
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    printf '  stopped :%s\n' "$port"
  fi
done
echo "KYA stack down."
