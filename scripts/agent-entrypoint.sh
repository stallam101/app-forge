#!/bin/bash
set -e

mkdir -p /workspace/context

# Always send complete or error event when the script exits, regardless of what the agent did.
# The events route guards against overriding an already-terminal status, so double-posting is safe.
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

# Configure NVIDIA NIM as the model provider
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

# Always: filesystem MCP + bash MCP (for progress curl callbacks)
openclaw mcp set filesystem '{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/workspace/context"]}'
openclaw mcp set bash '{"command":"npx","args":["-y","mcp-shell"]}'

# Research phase: also add Tavily for web search
if [ "$PHASE" = "RESEARCH" ]; then
  openclaw mcp set tavily "{\"command\":\"npx\",\"args\":[\"-y\",\"tavily-mcp\"],\"env\":{\"TAVILY_API_KEY\":\"$TAVILY_API_KEY\"}}"
fi

# Write prompt and run agent (S3 sync happens in _cleanup trap on exit)
printf '%s' "$AGENT_PROMPT" > /workspace/prompt.md
openclaw agent --local --session-id "$JOB_ID" --message "$(cat /workspace/prompt.md)"
