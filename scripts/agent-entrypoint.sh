#!/bin/bash
set -e

mkdir -p /workspace/context

# Always send complete or error event when the script exits, regardless of what the agent did.
_cleanup() {
  local code=$?
  aws s3 sync /workspace/context/ "s3://$S3_BUCKET_NAME/$S3_PREFIX/" --quiet 2>/dev/null || true
  if [ $code -eq 0 ]; then
    curl -sf -X POST "$APPFORGE_CALLBACK_URL/api/jobs/$JOB_ID/events" \
      -H "Authorization: Bearer $JOB_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"type":"complete","message":"Agent phase complete"}' || true
  else
    curl -sf -X POST "$APPFORGE_CALLBACK_URL/api/jobs/$JOB_ID/events" \
      -H "Authorization: Bearer $JOB_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"error\",\"message\":\"Agent exited with code $code\"}" || true
  fi
}
trap _cleanup EXIT

# Sync S3 context files to local workspace
aws s3 sync "s3://$S3_BUCKET_NAME/$S3_PREFIX/" /workspace/context/ --quiet

# ── Model config ─────────────────────────────────────────────────────────────
openclaw config patch --stdin <<EOF
{
  "models": {
    "providers": {
      "nvidia": {
        "baseUrl": "https://integrate.api.nvidia.com/v1",
        "apiKey": "$NVIDIA_API_KEY",
        "models": [
          {
            "id": "nvidia/nemotron-3-super-120b-a12b",
            "name": "Nemotron 3 Super 120B",
            "api": "openai-completions"
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": "nvidia/nemotron-3-super-120b-a12b"
    }
  }
}
EOF

# ── Base MCPs (all phases) ───────────────────────────────────────────────────
# filesystem: read/write to /workspace/context (mirrored to S3 on exit)
openclaw mcp set filesystem '{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/workspace/context"]}'
# bash: run shell commands (curl, aws, npx, etc.)
openclaw mcp set bash '{"command":"npx","args":["-y","mcp-server-commands"]}'

# ── Phase-specific MCPs ──────────────────────────────────────────────────────

if [ "$PHASE" = "RESEARCH" ]; then
  openclaw mcp set tavily "{\"command\":\"npx\",\"args\":[\"-y\",\"tavily-mcp\"],\"env\":{\"TAVILY_API_KEY\":\"$TAVILY_API_KEY\"}}"
fi

if [ "$PHASE" = "GENERATION" ] || [[ "$PHASE" == MAINTAIN_* ]]; then
  # GitHub MCP: repo creation, file commits, PRs
  openclaw mcp set github "{\"command\":\"npx\",\"args\":[\"-y\",\"@modelcontextprotocol/server-github\"],\"env\":{\"GITHUB_PERSONAL_ACCESS_TOKEN\":\"$GITHUB_TOKEN\"}}"
fi

# ── Run agent ────────────────────────────────────────────────────────────────
printf '%s' "$AGENT_PROMPT" > /workspace/prompt.md

echo "[appforge] Phase=$PHASE JobId=$JOB_ID"
echo "[appforge] MCP servers configured:"
openclaw mcp list 2>/dev/null || true

openclaw agent --local --session-id "$JOB_ID" --message "$(cat /workspace/prompt.md)"
