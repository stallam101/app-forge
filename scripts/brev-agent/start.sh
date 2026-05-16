#!/usr/bin/env bash
# Start the FastAPI wrapper on :8080 in the background.
# Run from inside ~/appforge-agent after setup.sh has succeeded.

set -euo pipefail

WORKDIR="${HOME}/appforge-agent"
PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"

cd "${WORKDIR}"
# shellcheck disable=SC1091
source .venv/bin/activate

# Make sure server.py is present alongside this script.
if [ ! -f server.py ]; then
  echo "ERROR: server.py not found in ${WORKDIR}. scp it from your laptop:"
  echo "  scp scripts/brev-agent/server.py ubuntu@<brev-host>:${WORKDIR}/"
  exit 1
fi

mkdir -p logs
LOG="logs/uvicorn-$(date +%Y%m%d-%H%M%S).log"

# Stop any previous instance on the same port.
if lsof -ti :"${PORT}" >/dev/null 2>&1; then
  echo "==> stopping previous uvicorn on :${PORT}"
  lsof -ti :"${PORT}" | xargs -r kill || true
  sleep 1
fi

echo "==> starting uvicorn on ${HOST}:${PORT}"
nohup uvicorn server:app --host "${HOST}" --port "${PORT}" \
  >"${LOG}" 2>&1 &
PID=$!
echo "${PID}" > .uvicorn.pid
sleep 2

if kill -0 "${PID}" 2>/dev/null; then
  echo "==> running, pid ${PID}, log ${WORKDIR}/${LOG}"
  echo "==> health: curl http://localhost:${PORT}/healthz"
else
  echo "ERROR: uvicorn died on start. Tail of log:"
  tail -n 40 "${LOG}"
  exit 1
fi
