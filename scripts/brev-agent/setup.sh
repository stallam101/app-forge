#!/usr/bin/env bash
# Run this on the Brev box after first SSH.
# Idempotent — safe to re-run.

set -euo pipefail

WORKDIR="${HOME}/appforge-agent"

echo "==> 1/5 apt prereqs"
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
  python3.11 python3.11-venv python3-pip \
  git curl jq ca-certificates

if ! command -v node >/dev/null 2>&1; then
  echo "==> installing Node 20 (for MCP servers)"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> 2/5 workdir layout at ${WORKDIR}"
mkdir -p "${WORKDIR}"/{runs,projects,logs,configs/openclaw,configs/prompts}
# Filesystem MCP root expected by configs/openclaw/research.json
if [ ! -d /workspace/context ]; then
  sudo mkdir -p /workspace/context
  sudo chown -R "$(id -u):$(id -g)" /workspace
fi

echo "==> 3/5 python venv + deps"
cd "${WORKDIR}"
if [ ! -d .venv ]; then
  python3.11 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet fastapi 'uvicorn[standard]' httpx pydantic

echo "==> 4/5 pre-warm MCP servers (npm cache)"
npx -y @modelcontextprotocol/server-filesystem --help >/dev/null 2>&1 || true
npx -y tavily-mcp --help >/dev/null 2>&1 || true
npx -y mcp-server-commands --help >/dev/null 2>&1 || true

echo "==> 5/5 gpu sanity"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi | head -n 15
else
  echo "WARNING: nvidia-smi not found. Verify GPU drivers."
fi

echo
echo "Setup complete."
echo "Next:"
echo "  1) scp configs/openclaw/research.json + configs/prompts/research.md into ${WORKDIR}/configs/..."
echo "  2) Install OpenClaw per nvidia.com/clawhelp (binary on \$PATH or set OPENCLAW_BIN)"
echo "  3) bash ${WORKDIR}/start.sh   # starts uvicorn on :8080"
