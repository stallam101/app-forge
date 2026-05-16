#!/bin/bash
set -e

echo "$OPENCLAW_CONFIG" > /workspace/openclaw-runtime.json
echo "$AGENT_PROMPT" > /workspace/prompt.md

mkdir -p /workspace/context

openclaw --config /workspace/openclaw-runtime.json --prompt /workspace/prompt.md
