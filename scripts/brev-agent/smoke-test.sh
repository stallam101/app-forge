#!/usr/bin/env bash
# Smoke test the Brev wrapper from your laptop.
# Sends a synthetic POST /run and watches AppForge for the resulting JobEvent rows.
#
# Required env (export before running, or pass via .env):
#   BREV_AGENT_URL       — public URL of the Brev wrapper (e.g. https://...-8080.brev.dev)
#   APPFORGE_BASE_URL    — ngrok URL pointing at localhost:3000 (or a public AppForge)
#   NVIDIA_API_KEY       — Nemotron key from build.nvidia.com
#   TAVILY_API_KEY       — Tavily key
#   JOB_ID               — id of a seeded Job row in AppForge (see usage below)
#   JOB_TOKEN            — that job's jobToken column
#   PROJECT_ID           — that job's projectId
#
# To get a real JOB_ID/JOB_TOKEN/PROJECT_ID for the smoke test:
#   1. In AppForge UI, create a new project (or use a seeded one)
#   2. From a psql shell against the appforge DB:
#        SELECT id, "jobToken", "projectId" FROM "Job" ORDER BY "createdAt" DESC LIMIT 1;
#   3. Paste those values here.
#
# Usage:
#   ./smoke-test.sh

set -euo pipefail

: "${BREV_AGENT_URL:?BREV_AGENT_URL is required}"
: "${APPFORGE_BASE_URL:?APPFORGE_BASE_URL is required}"
: "${NVIDIA_API_KEY:?NVIDIA_API_KEY is required}"
: "${JOB_ID:?JOB_ID is required}"
: "${JOB_TOKEN:?JOB_TOKEN is required}"
: "${PROJECT_ID:?PROJECT_ID is required}"

TAVILY_API_KEY="${TAVILY_API_KEY:-}"
NVIDIA_BASE_URL="${NVIDIA_BASE_URL:-https://integrate.api.nvidia.com/v1}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONFIG_FILE="${REPO_ROOT}/configs/openclaw/research.json"
PROMPT_FILE="${REPO_ROOT}/configs/prompts/research.md"

[ -f "${CONFIG_FILE}" ] || { echo "missing ${CONFIG_FILE}"; exit 1; }
[ -f "${PROMPT_FILE}" ] || { echo "missing ${PROMPT_FILE}"; exit 1; }

# Substitute prompt variables the same way dispatchToBrev does in agent-runner.ts.
PROMPT_TEXT="$(
  sed \
    -e "s|{PROJECT_ID}|${PROJECT_ID}|g" \
    -e "s|{S3_PREFIX}|projects/${PROJECT_ID}|g" \
    -e "s|{JOB_ID}|${JOB_ID}|g" \
    -e "s|{CALLBACK_URL}|${APPFORGE_BASE_URL}|g" \
    -e "s|{JOB_TOKEN}|${JOB_TOKEN}|g" \
    "${PROMPT_FILE}"
)"

CONFIG_TEXT="$(cat "${CONFIG_FILE}")"

PAYLOAD="$(jq -n \
  --arg jobId "${JOB_ID}" \
  --arg phase "RESEARCH" \
  --arg projectId "${PROJECT_ID}" \
  --arg callbackUrl "${APPFORGE_BASE_URL}" \
  --arg callbackToken "${JOB_TOKEN}" \
  --arg brief "Smoke test brief: a recipe-suggestion app." \
  --arg openclawConfig "${CONFIG_TEXT}" \
  --arg agentPrompt "${PROMPT_TEXT}" \
  --arg nvKey "${NVIDIA_API_KEY}" \
  --arg nvBase "${NVIDIA_BASE_URL}" \
  --arg tav "${TAVILY_API_KEY}" \
  '{
    jobId: $jobId,
    phase: $phase,
    projectId: $projectId,
    callbackUrl: $callbackUrl,
    callbackToken: $callbackToken,
    brief: $brief,
    openclawConfig: $openclawConfig,
    agentPrompt: $agentPrompt,
    env: { NVIDIA_API_KEY: $nvKey, NVIDIA_BASE_URL: $nvBase, TAVILY_API_KEY: $tav }
  }'
)"

echo "==> POST ${BREV_AGENT_URL%/}/run"
START_NS=$(date +%s%N)
RESPONSE="$(
  curl -sS -X POST "${BREV_AGENT_URL%/}/run" \
    -H "Content-Type: application/json" \
    --max-time 12 \
    -d "${PAYLOAD}"
)"
ELAPSED_MS=$(( ( $(date +%s%N) - START_NS ) / 1000000 ))

echo "  elapsed: ${ELAPSED_MS}ms"
echo "  body: ${RESPONSE}"

if [ "${ELAPSED_MS}" -gt 5000 ]; then
  echo "WARNING: /run took >5s. AppForge dispatchToBrev times out at 10s — investigate spawn blocking."
fi

if ! echo "${RESPONSE}" | jq -e '.ok == true' >/dev/null; then
  echo "FAIL: wrapper did not return ok:true"
  exit 1
fi

echo
echo "==> /run accepted. Now watch AppForge's JobEvent table:"
echo "    SELECT type, message, \"createdAt\" FROM \"JobEvent\""
echo "      WHERE \"jobId\" = '${JOB_ID}' ORDER BY \"createdAt\" DESC LIMIT 20;"
echo
echo "Expected timeline:"
echo "  ~0s:    /run returns ok:true"
echo "  <10s:   first 'progress' event"
echo "  <2min:  'complete' event, Job.status = COMPLETE"
