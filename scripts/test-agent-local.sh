#!/bin/bash
# Run the agent container locally for debugging.
# Usage: ./scripts/test-agent-local.sh <phase> <project_id>
#   e.g. ./scripts/test-agent-local.sh GENERATION cmp8wptw2000004l3j2kvmvqj
#
# Requires:
#   - Docker running
#   - .env in project root (reads secrets from there)
#   - aws cli authenticated (to pull from ECR)

set -e

PHASE="${1:-GENERATION}"
PROJECT_ID="${2:-}"
ECR_IMAGE="517725157271.dkr.ecr.us-east-1.amazonaws.com/appforge-agent:latest"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 <phase> <project_id>"
  exit 1
fi

# Load vars from .env
source <(grep -v '^#' .env | sed 's/^/export /' | sed 's/="*/=/' | sed 's/"*$//')

echo "==> Pulling latest image from ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 517725157271.dkr.ecr.us-east-1.amazonaws.com
docker pull "$ECR_IMAGE"

# Fetch the job prompt by creating a throwaway test job via the DB
# For testing, use a minimal prompt override
AGENT_PROMPT="Debug run for project $PROJECT_ID phase $PHASE. List the context files available and report what you find, then exit."

echo "==> Running $PHASE agent for project $PROJECT_ID..."
echo "==> All stdout from the container will appear below:"
echo "----------------------------------------------------"

docker run --rm -it \
  -e PHASE="$PHASE" \
  -e PROJECT_ID="$PROJECT_ID" \
  -e JOB_ID="debug-$(date +%s)" \
  -e JOB_TOKEN="debug-token" \
  -e S3_PREFIX="projects/$PROJECT_ID" \
  -e S3_BUCKET_NAME="$S3_BUCKET_NAME" \
  -e APPFORGE_CALLBACK_URL="http://host.docker.internal:3000" \
  -e NVIDIA_API_KEY="$NVIDIA_API_KEY" \
  -e GITHUB_TOKEN="$GITHUB_TOKEN" \
  -e TAVILY_API_KEY="$TAVILY_API_KEY" \
  -e AWS_REGION="${AWS_REGION:-us-east-1}" \
  -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  --add-host host.docker.internal:host-gateway \
  "$ECR_IMAGE"
