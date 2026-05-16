# AppForge — Architecture

> **Hackathon scope (2026-05-16):** This doc describes the runtime architecture we are shipping right now. Compute runs on **Brev** (NVIDIA's GPU cloud). The agent harness is **OpenClaw**. The model is **Nemotron 3 Super 120B** via `https://integrate.api.nvidia.com/v1`. Only the **Research** phase is wired to a real agent; Generation and Maintain ship as honest UI stubs.

## Infrastructure Overview

```
                              ┌─────────┐
                              │  User   │
                              └────┬────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  AppForge — Next.js app + API routes + Vercel Cron                │
│  (local for hackathon, Vercel in prod)                            │
│  Ticket-creation chat: Claude Sonnet via AI SDK (no autonomous   │
│  compute)                                                         │
└──────┬───────────────────────────┬──────────────────────────┬────┘
       │                           │ POST /run                │
       ▼                           ▼                          ▼
┌──────────────┐    ┌──────────────────────────────┐   ┌──────────┐
│   Postgres   │    │  Brev.dev GPU instance        │   │    S3    │
│ docker-compose│    │  OpenClaw daemon + HTTP :8080 │   │ (or local│
│ locally /    │    │  LLM: Nemotron 3 Super 120B   │   │  FS on   │
│ RDS Postgres │    │  https://integrate.api.       │   │  Brev)   │
│ in prod      │    │       nvidia.com/v1           │   │ Context  │
│              │    │  Tools: web_search,           │   │ Engine   │
│ Job/JobEvent │    │         file_write, fetch     │   │ wiki per │
│ Message/     │    │                               │   │ project  │
│ Approval/    │    └──────────────┬────────────────┘   └──────────┘
│ Setting/User │                   │ POST /api/jobs/{jobId}/events
│ Project      │                   │ Authorization: Bearer {JOB_TOKEN}
└──────────────┘                   ▼
                              AppForge (callback)

Flow: Vercel Cron → POST /run → Brev → callback POST
      /api/jobs/{jobId}/events with Bearer JOB_TOKEN
```

## Components

### Next.js App
- Serves kanban UI, approvals page, settings page, ticket-creation chat.
- API routes handle project CRUD, job queue management, SSE streams.
- A poller endpoint (`/api/cron/queue-poller`) is hit by Vercel Cron every 60s to dispatch QUEUED jobs to Brev. A `/api/jobs/[jobId]/kick` route fires the same dispatch on demand for one-click demos.
- Ticket-creation chat streams directly from a Next.js API route via `@ai-sdk/anthropic` (Claude Sonnet) — Nemotron swap is optional, Sonnet is the current path.

### Job Queue (Postgres-based)
- `Job` table tracks all phase work: `QUEUED → RUNNING → COMPLETE | FAILED | BLOCKED | AWAITING_APPROVAL`.
- Vercel Cron polls every minute; no Redis, no BullMQ.
- Poller logic: for each phase, if no `RUNNING` job exists, launch the oldest `QUEUED` job.

### Brev Agent (replaces ECS Fargate agent runtime)
Single Brev GPU instance with OpenClaw + Nemotron + tools pre-installed. Exposes an HTTP server on port 8080:

```
POST /run
  body: { jobId, phase, projectId, callbackUrl, callbackToken, brief }
```

The server:
1. Spawns OpenClaw with the phase prompt + brief.
2. Streams stdout, parses key events (progress, blocker, complete).
3. POSTs each event to `${callbackUrl}/api/jobs/${jobId}/events` with `Authorization: Bearer ${callbackToken}`.

The Brev port is forwarded publicly; the URL is shared with the Next.js app as `BREV_AGENT_URL` in `.env`. **One Brev instance handles all phases in 1-hour scope.**

### OpenClaw Tool Infrastructure
Phase configs live on the Brev instance at `configs/openclaw/{phase}.json`. Active phases for the hackathon:

| Phase | Tools enabled | Status |
|-------|---------------|--------|
| **ticket-context-build** | filesystem, s3-or-local-fs, tavily | real, dispatched to Brev |
| **research** | filesystem, s3-or-local-fs, tavily, fetch, file_write | real, qualifying phase |
| generation | (configured, not dispatched) | stubbed in 1-hour scope |
| maintain-* | (configured, not dispatched) | seed-only in 1-hour scope |

All Brev-side phases use Nemotron 3 Super 120B via `https://integrate.api.nvidia.com/v1` (OpenAI-compatible).

### Postgres (metadata store)

Unchanged schema. **Hackathon:** docker-compose Postgres at port 5433. **Prod:** RDS Postgres.

Tables:
- `User` — single seeded admin row (email + bcrypt hash). Auth: JWT in httpOnly cookie.
- `Project` — id, name, description, status (READY/RESEARCH/GENERATION/MAINTAIN/ARCHIVED), `s3Prefix`, timestamps.
- `Job` — id, projectId, phase, status, `agentRunId` (Brev run handle, nullable), `jobToken` (unique CUID — authenticates agent callbacks), timestamps.
- `JobEvent` — id, jobId, type (progress/blocker/approval_request/complete/error), message, metadata (JSON), createdAt.
- `Message` — id, projectId, role (user/assistant), content, turn, metadata, createdAt.
- `Approval` — id, projectId, jobId (nullable), title, description, type, metadata, status (PENDING/APPROVED/REJECTED), timestamps.
- `Setting` — id, key (unique), value (AES-256 encrypted) — global secrets: `NVIDIA_API_KEY`, `TAVILY_API_KEY`, `GITHUB_TOKEN`, etc.

### S3 (Context Engine store)
Unchanged layout (see `08-context-engine.md`). **Hackathon swap:** if no AWS creds are present, the agent writes to local `/workspace/context` on Brev using the same paths.

```
projects/{project-id}/
  brief.md                  ← seeded at ticket creation, immutable
  platform-constraints.md   ← seeded, immutable
  project-context.md        ← front page; rewritten by each phase
  index.md                  ← wiki catalog; agent updates after every write
  log.md                    ← append-only audit trail
  [research/...]            ← agent-created research artifacts
```

Agents load files lazily: `platform-constraints.md` → `index.md` → `project-context.md` → selective files based on the index. See `08-context-engine.md` for the full spec.

## Queue Behavior

- One active runner per phase at a time.
- Multiple phases can run simultaneously across different projects.
- **GENERATION and MAINTAIN_* jobs are queued but immediately marked `BLOCKED` with a "Configure {GitHub|Vercel} token in Settings" JobEvent in 1-hour scope. They are not dispatched to Brev.**
- `BLOCKED` jobs stay `BLOCKED` until the user resolves the blocker (adds a missing key, makes a decision) — then a new `Job` row is created `QUEUED`.
- Failed jobs: logged in `JobEvent`, card shows `failed`, manual retry.
- Ticket-creation conversation turns are **not queued** — handled directly by Vercel AI SDK in API routes.

## Secrets Flow

1. User enters secret in settings UI.
2. API route encrypts with AES-256, upserts to `Setting` table in Postgres.
3. Brev instance has its own `NVIDIA_API_KEY` and `TAVILY_API_KEY` env vars (set at provision time). AppForge sends per-job dynamic context (`JOB_TOKEN`, brief, callback URL) in the `POST /run` body.
4. Secret is never written to the markdown wiki or logs.
5. Agent receives secrets only as in-memory env vars within the OpenClaw process.

## External Integrations (hackathon)

| Service | Purpose | Auth |
|---------|---------|------|
| **build.nvidia.com** (Nemotron) | LLM inference | `NVIDIA_API_KEY` (env var on Brev) |
| **Tavily** | Live web search tool | `TAVILY_API_KEY` (env var on Brev) |
| Anthropic (Claude) | Ideation chat in Next.js | `ANTHROPIC_API_KEY` (env var locally) |
| Vercel deploy | Generation phase deploy target | roadmap — Generation is stubbed in 1-hour scope |

Post-hackathon integrations (GitHub, Vercel, Reddit, X, PagerDuty) are documented in the phase docs but are not wired this hackathon.
