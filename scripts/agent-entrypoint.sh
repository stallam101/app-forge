#!/bin/bash
set -e

mkdir -p /workspace/context

# Configure NVIDIA NIM as the model provider
openclaw config patch --stdin <<EOF
{
  "models": {
    "providers": {
      "nvidia": {
        "baseUrl": "https://integrate.api.nvidia.com/v1",
        "apiKey": "$NVIDIA_API_KEY"
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

# Register MCP servers
openclaw mcp set filesystem '{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/workspace/context"]}'
openclaw mcp set s3 "{\"command\":\"npx\",\"args\":[\"-y\",\"mcp-s3\"],\"env\":{\"AWS_REGION\":\"$AWS_REGION\",\"AWS_ACCESS_KEY_ID\":\"$AWS_ACCESS_KEY_ID\",\"AWS_SECRET_ACCESS_KEY\":\"$AWS_SECRET_ACCESS_KEY\",\"S3_BUCKET\":\"$S3_BUCKET_NAME\"}}"

# Write prompt and run agent
printf '%s' "$AGENT_PROMPT" > /workspace/prompt.md
openclaw agent --local --message "$(cat /workspace/prompt.md)"
