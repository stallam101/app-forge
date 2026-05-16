# Brev agent — Person 1 deliverable

OpenClaw + Nemotron + Tavily HTTP wrapper that runs on a Brev.dev GPU box and
accepts `POST /run` from AppForge. This directory holds everything Person 1
scp's to the Brev instance.

## Files

| File | What it is |
|---|---|
| `server.py` | FastAPI app exposing `POST /run` and `GET /healthz` |
| `setup.sh` | Idempotent first-time setup on the Brev box (apt, venv, dirs, MCP pre-warm) |
| `start.sh` | Start uvicorn on `:8080` under nohup |
| `smoke-test.sh` | Send a synthetic `/run` from your laptop, watch JobEvents in AppForge |

## Flow (matches the plan)

### 1 — Provision Brev + Tavily key

- Brev workspace: A100 40GB, Ubuntu 22.04, expose port 8080 publicly
- Tavily free key from <https://tavily.com>
- Confirm NVIDIA key:
  ```
  curl https://integrate.api.nvidia.com/v1/models \
    -H "Authorization: Bearer $NVIDIA_API_KEY" | jq '.data[].id' | grep nemotron
  ```

### 2 — Setup on the Brev box

```
brev shell <workspace>
# OR: ssh ubuntu@<brev-host>

# from laptop, scp this whole directory + the OpenClaw config + prompt:
scp scripts/brev-agent/*.{py,sh} ubuntu@<brev-host>:~/appforge-agent/
scp configs/openclaw/research.json ubuntu@<brev-host>:~/appforge-agent/configs/openclaw/
scp configs/prompts/research.md   ubuntu@<brev-host>:~/appforge-agent/configs/prompts/

# on the Brev box:
mkdir -p ~/appforge-agent && cd ~/appforge-agent
bash setup.sh
```

### 3 — Install OpenClaw on the Brev box

Follow <https://nvidia.com/clawhelp>. After install, either put the binary on
`$PATH` as `openclaw` or set `OPENCLAW_BIN=/full/path/to/openclaw`.

If OpenClaw uses a different subcommand than `run --config ... --prompt-file ...`,
override the args:

```
export OPENCLAW_RUN_ARGS="agent --config {config_path} --prompt {prompt_path}"
```

`{config_path}` and `{prompt_path}` get substituted per run.

### 4 — Start the wrapper

```
bash start.sh
curl http://localhost:8080/healthz   # -> {"ok": true}
```

Public URL: whatever Brev shows for port 8080, e.g.
`https://<workspace>-8080.brev.dev`. If Brev's port exposure is flaky, run
cloudflared instead:

```
cloudflared tunnel --url http://localhost:8080
```

Share the public URL with the team as `BREV_AGENT_URL`.

### 5 — Smoke test from laptop

The demo laptop needs to be reachable from Brev so callbacks land. Run ngrok
against AppForge's dev server:

```
ngrok http 3000   # copy https://*.ngrok-free.app
```

Then from `/Users/ashar/Documents/Dev/app-forge`:

```
# .env on laptop:
BREV_AGENT_URL=https://<workspace>-8080.brev.dev
APPFORGE_BASE_URL=https://<your>.ngrok-free.app
NVIDIA_API_KEY=...
TAVILY_API_KEY=tvly-...

# verify reachability FROM the Brev box first:
brev shell <workspace>
curl "$APPFORGE_BASE_URL/api/health"   # should hit your localhost:3000

# then smoke test (need a real seeded Job row's id/jobToken/projectId):
export JOB_ID=... JOB_TOKEN=... PROJECT_ID=...
bash scripts/brev-agent/smoke-test.sh
```

Expected:

- `/run` returns `{ok:true, runId}` in <5s
- First `progress` JobEvent within 10s
- `complete` JobEvent within ~2 min, `Job.status = COMPLETE`

## Contract (must match `src/lib/agent-runner.ts`)

```
POST /run
Headers: Content-Type: application/json
         [optional] Authorization: Bearer ${BREV_AGENT_SECRET}
Body: {
  jobId, phase, projectId,
  callbackUrl, callbackToken,
  brief, openclawConfig, agentPrompt,
  env: { NVIDIA_API_KEY, NVIDIA_BASE_URL, TAVILY_API_KEY }
}
Returns: { ok: true, runId } within 5s
```

Callbacks: `POST ${callbackUrl}/api/jobs/${jobId}/events`,
`Authorization: Bearer ${callbackToken}`,
body `{type, message, metadata?}`. Event types map to Job status in
`src/app/api/jobs/[jobId]/events/route.ts`:

| `type` | `Job.status` after |
|---|---|
| `progress` | (no change, stays RUNNING) |
| `blocker` | `BLOCKED` |
| `approval_request` | `AWAITING_APPROVAL` |
| `complete` | `COMPLETE` |
| `error` | `FAILED` |

## Operational notes

- The wrapper guarantees a terminal `complete` or `error` callback on subprocess
  exit. The prompt's own curl progress callbacks are independent and additive.
- Each run gets its own dir under `~/appforge-agent/runs/<runId>/` with the
  interpolated config + prompt for replay. Logs go to
  `~/appforge-agent/logs/<runId>.log`.
- Project artifacts (the agent's `file_write` output) land under
  `~/appforge-agent/projects/<projectId>/`.
- Restart the wrapper by re-running `bash start.sh` — it kills any previous
  uvicorn on the same port before starting.

## Eligibility floor

Never cut these — they are what qualifies the project for the Cloud Track prize:

1. Nemotron model called via `integrate.api.nvidia.com/v1`
2. At least one tool call (web_search or file_write)
3. A terminal `complete` callback flipping `Job.status` to `COMPLETE`

If OpenClaw won't install, switch to **Hermes Agent** (the other allowed harness),
not a hand-rolled tool loop — hand-rolled disqualifies the project.
