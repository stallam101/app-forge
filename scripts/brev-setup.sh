#!/bin/bash
# AppForge Brev instance setup script.
# Run once on a fresh Brev workspace.
# Usage: bash brev-setup.sh
set -euo pipefail

REPO_URL="${APPFORGE_REPO_URL:-}"   # e.g. https://github.com/yourorg/app-forge.git
DISPATCH_SECRET="${DISPATCH_SECRET:-}"
NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"
TAVILY_API_KEY="${TAVILY_API_KEY:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"
S3_BUCKET_NAME="${S3_BUCKET_NAME:-}"

if [[ -z "$DISPATCH_SECRET" ]]; then
  echo "ERROR: DISPATCH_SECRET env var required"
  exit 1
fi

echo "==> Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  curl wget git unzip ca-certificates gnupg lsb-release \
  build-essential python3 python3-pip awscli

echo "==> Installing Node.js 22"
if ! command -v node &>/dev/null || [[ "$(node --version | cut -d. -f1)" != "v22" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
echo "Node $(node --version) / npm $(npm --version)"

echo "==> Installing GitHub CLI"
if ! command -v gh &>/dev/null; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
    https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list
  apt-get update -qq
  apt-get install -y -qq gh
fi

echo "==> Installing global npm packages"
npm install -g --quiet \
  vercel \
  openclaw \
  @modelcontextprotocol/server-filesystem \
  @modelcontextprotocol/server-github \
  mcp-shell \
  tavily-mcp \
  @executeautomation/mcp-playwright

echo "==> Installing Playwright Chromium"
npx playwright install chromium --with-deps 2>/dev/null || true

echo "==> Creating workspace directories"
mkdir -p /workspace/jobs

echo "==> Writing environment file"
cat > /etc/appforge.env <<ENV
DISPATCH_SECRET=${DISPATCH_SECRET}
NVIDIA_API_KEY=${NVIDIA_API_KEY}
TAVILY_API_KEY=${TAVILY_API_KEY}
AWS_REGION=${AWS_REGION}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
S3_BUCKET_NAME=${S3_BUCKET_NAME}
DISPATCH_PORT=18789
ENV
chmod 600 /etc/appforge.env

echo "==> Cloning AppForge repo (for dispatch server script)"
APPFORGE_DIR=/opt/appforge
if [[ -n "$REPO_URL" ]]; then
  if [[ -d "$APPFORGE_DIR/.git" ]]; then
    git -C "$APPFORGE_DIR" pull --ff-only
  else
    git clone "$REPO_URL" "$APPFORGE_DIR"
  fi
else
  echo "  APPFORGE_REPO_URL not set — copy scripts/brev-dispatch-server.js to /opt/appforge/scripts/ manually"
  mkdir -p /opt/appforge/scripts
fi

echo "==> Writing systemd service"
cat > /etc/systemd/system/appforge-dispatch.service <<SERVICE
[Unit]
Description=AppForge Agent Dispatch Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/appforge
EnvironmentFile=/etc/appforge.env
ExecStart=/usr/bin/node /opt/appforge/scripts/brev-dispatch-server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

echo "==> Enabling and starting service"
systemctl daemon-reload
systemctl enable appforge-dispatch
systemctl restart appforge-dispatch

echo ""
echo "==> Setup complete!"
echo "    Dispatch server: http://$(curl -sf ifconfig.me 2>/dev/null || echo '<this-ip>'):18789"
echo "    Health check:    curl http://localhost:18789/health"
echo "    Logs:            journalctl -u appforge-dispatch -f"
echo ""
echo "    Set in Vercel env vars:"
echo "      OPENCLAW_GATEWAY_URL=http://$(curl -sf ifconfig.me 2>/dev/null || echo '<this-ip>'):18789"
echo "      OPENCLAW_GATEWAY_TOKEN=<same as DISPATCH_SECRET>"
