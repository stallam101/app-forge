#!/bin/bash
set -e

mkdir -p /workspace/context

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

# Register filesystem MCP (reads/writes /workspace/context)
openclaw mcp set filesystem '{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/workspace/context"]}'

# Write prompt and run agent
printf '%s' "$AGENT_PROMPT" > /workspace/prompt.md
openclaw agent --local --session-id "$JOB_ID" --message "$(cat /workspace/prompt.md)"

# Sync results back to S3
aws s3 sync /workspace/context/ "s3://$S3_BUCKET_NAME/$S3_PREFIX/" --quiet
