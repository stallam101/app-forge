# Person 2 — AppForge ↔ Brev Wiring (Plan)

> **Owner:** Person 2 — the bridge between AppForge's queue and the Brev agent service.
> **Goal:** Replace the legacy ECS launch path with HTTP POST dispatch to the Brev agent, gate stubbed phases honestly as BLOCKED, and ship a demo-day kick endpoint that bypasses the 1-minute cron.
> **Status:** SHIPPED (see [current-status.md](./current-status.md)). This doc is preserved for context + audit.

## 1. Requirements Restatement (verbatim)

- **NEW** `src/lib/agent-runner.ts` — `dispatchToBrev(job)` POSTs to `${BREV_AGENT_URL}/run`
- **MODIFY** `src/app/api/cron/queue-poller/route.ts` — replace ECS launch with `dispatchToBrev` for Research (+ TICKET_CONTEXT_BUILD); mark Generation and Maintain jobs as `BLOCKED` with message `"Configure {GitHub|Vercel} token in Settings to enable this phase"`
- **VERIFY** `src/app/api/jobs/[jobId]/events/route.ts` — Bearer-token auth works with what P1 sends
- **NEW** `src/app/api/jobs/[jobId]/kick/route.ts` — one-click demo firing endpoint, no cron wait
- **NEW** `.env.example` — add `BREV_AGENT_URL`, `NVIDIA_API_KEY`, `NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1`, `TAVILY_API_KEY`

Already in place before P2 started (do not re-do):

- `src/app/api/jobs/[jobId]/events/route.ts` already validates `Authorization: Bearer {job.jobToken}` and maps event types → JobStatus via `STATUS_MAP`.
- `vercel.json` already has the queue-poller cron at `* * * * *`.
- `Job.jobToken` (unique CUID) on every job row.
- `Job.ecsTaskArn` nullable — reused to store the Brev `runId`. **No schema change needed.**
- Phase configs in `configs/openclaw/` and prompt templates in `configs/prompts/`.

## 2. Implementation Summary

### 2.1 `src/lib/agent-runner.ts` (NEW)

Exports:

- `BREV_PHASES: ReadonlySet<JobPhase>` — `{ TICKET_CONTEXT_BUILD, RESEARCH }`
- `STUB_BLOCKER_MESSAGE` — `{ GENERATION, MAINTAIN_SEO, MAINTAIN_AEO, MAINTAIN_INCIDENT } → { message, required }`
- `dispatchToBrev(jobId, phase, projectId): Promise<{ runId }>`

Inside `dispatchToBrev`:

1. Throw fast if `BREV_AGENT_URL` unset.
2. Throw if phase not in `BREV_PHASES`.
3. Load job + project, decrypt all `Setting` rows (fallback to raw value).
4. Read `configs/openclaw/{phase}.json` and `configs/prompts/{phase}.md`, interpolate `{PROJECT_ID}`, `{S3_PREFIX}`, `{JOB_ID}`, `{CALLBACK_URL}`, `{JOB_TOKEN}`.
5. POST to `${BREV_AGENT_URL}/run` with body `{jobId, phase, projectId, callbackUrl, callbackToken, brief, openclawConfig, agentPrompt, env}`. Optional `Authorization: Bearer ${BREV_AGENT_SECRET}` header. `AbortSignal.timeout(10_000)`.
6. On non-2xx: throw with status + body text.
7. Parse `{runId?}`; fallback to `crypto.randomUUID()` if absent.
8. `db.job.update({ status: "RUNNING", ecsTaskArn: runId })`.
9. Return `{ runId }`.

### 2.2 `src/app/api/cron/queue-poller/route.ts` (MODIFIED)

- Import swapped: `launchECSTask` → `dispatchToBrev`, plus `BREV_PHASES` and `STUB_BLOCKER_MESSAGE`.
- Loop body: if `BREV_PHASES.has(phase)` → dispatch; else → set `BLOCKED` + insert blocker event with `metadata: { required, phase }`.
- Stale-RUNNING sweep (15 min) untouched.
- Cron auth (Bearer `CRON_SECRET`) untouched.
- **No infinite-loop risk**: poller only scans `status: "QUEUED"`; BLOCKED jobs don't re-enter.

### 2.3 `src/app/api/jobs/[jobId]/kick/route.ts` (NEW)

`POST /api/jobs/{jobId}/kick`:

1. `getCurrentUser()` (JWT cookie); 401 if anonymous.
2. 404 if job missing.
3. 409 with `{ error, currentStatus }` if `status !== "QUEUED"` — idempotency guard against cron race.
4. 400 if phase not in `BREV_PHASES` — stubbed phases should land BLOCKED via cron, not be kicked.
5. Call `dispatchToBrev`; on throw, mark FAILED + insert error event + return 502.
6. Success: `{ ok: true, runId }`.

### 2.4 `.env.example` (NEW)

All env keys consumed across AppForge + Brev coordination:

`DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `BREV_AGENT_URL`, `BREV_AGENT_SECRET`, `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `TAVILY_API_KEY`, `APPFORGE_BASE_URL`, `ANTHROPIC_API_KEY`, AWS keys (optional).

## 3. Contracts (what P1, P3, P4 rely on)

### To P1
- Receives `POST {BREV_AGENT_URL}/run` with body `{jobId, phase, projectId, callbackUrl, callbackToken, brief, openclawConfig, agentPrompt, env}`.
- Must respond 2xx within ~10s. Body `{ok: true, runId?}` (we fall back to UUID if no `runId`).
- Posts callbacks to `${callbackUrl}/api/jobs/{jobId}/events` with `Authorization: Bearer {callbackToken}` and body `{type, message, metadata?}`. Event types: `progress | blocker | approval_request | complete | error`.

### To P3
- Reads `JobEvent.metadata.required` on BLOCKED state to render correct token CTA:
  - `"GITHUB_TOKEN"` → "Configure GitHub token"
  - `"VERCEL_TOKEN"` → "Configure Vercel token"
  - `"PAGERDUTY_WEBHOOK"` → "Configure PagerDuty webhook"
- The "kick" insurance button → `POST /api/jobs/{jobId}/kick` (cookie auth, no body), expects `{ok, runId}` / 409 / 400 / 502.

### To P4
- Kick URL above is the demo-day "Run Research" button — bypasses 60s cron.
- `Job.ecsTaskArn` now holds Brev `runId` (not an ECS ARN). Label "Run ID" in any UI that surfaces it.
- Do NOT seed QUEUED `MAINTAIN_*` or `GENERATION` jobs — they will BLOCKED on the next cron tick. Seed COMPLETE + PENDING Approval instead.

## 4. Risks & Mitigations (post-ship)

| Risk | Sev | Status |
|---|---|---|
| Brev unreachable / URL missing | HIGH | `dispatchToBrev` throws clear error; poller's existing try/catch marks FAILED + emits error event. Loud, not silent. |
| Callback auth mismatch with P1 | HIGH | Existing route validates `Bearer {job.jobToken}`; we send `callbackToken: job.jobToken` in `/run` body. Coordinate at min 30. |
| GENERATION/MAINTAIN re-fire each cron tick | HIGH | Verified: poller scans `status: "QUEUED"`; BLOCKED jobs don't re-enter the loop. |
| Dual-launch race (cron + kick) | MED | Kick endpoint's `status === "QUEUED"` check is the lock; first writer wins, second gets 409. |
| Brev returns 200 but OpenClaw never starts | MED | 15-min stale-RUNNING sweep marks FAILED + emits error. Recovery: re-queue a new job. |
| `secrets.decrypt()` throws on ENCRYPTION_KEY mismatch | MED | Try/catch fallback to raw value (mirrors `ecs.ts:31-34`). |
| `AbortSignal.timeout(10_000)` kills slow Brev spawn | LOW | 10s is generous for "spawn and return". Bump if P1 reports issues. |

## 5. Test Plan

Mock-Brev smoke test (works without P1's real URL):

```bash
# Terminal 1: 1-line mock Brev that echoes the body
node -e "require('http').createServer((req,res)=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{console.log('GOT:',d);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,runId:'mock-123'}))})}).listen(9999)"

# Terminal 2: BREV_AGENT_URL=http://localhost:9999 npm run dev

# Terminal 3 (verify):
# T1: poller dispatches RESEARCH → RUNNING + ecsTaskArn='mock-123'
# T2: poller BLOCKS GENERATION + emits blocker event with metadata.required='GITHUB_TOKEN'
# T3: second cron tick — no duplicate POST, no duplicate blocker event
# T4: POST /events with right token → 200; wrong token → 401
# T5: /kick on QUEUED → 200; second /kick → 409; /kick on GENERATION job → 400
# T6: npm run build — zero type errors
```

## 6. Definition of Done

- [x] `dispatchToBrev` HTTP path with timeout + clear errors
- [x] Queue poller swaps ECS launch for Brev dispatch on RESEARCH + TICKET_CONTEXT_BUILD
- [x] GENERATION + MAINTAIN_* mark BLOCKED with `metadata.required` for P3's CTA
- [x] Kick endpoint with cookie auth + idempotency + phase guards
- [x] `.env.example` with all coordination keys
- [x] `npm run build` green
- [ ] Real end-to-end with P1's `BREV_AGENT_URL` (blocked on P1)
