# AppForge — Architecture

## Infrastructure Overview

```
┌──────────────────────────────────────────────────────────┐
│  Vercel                                                    │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Next.js App (UI + API routes + Vercel Cron)     │    │
│  │  Ticket creation chat: Sonnet via AI SDK         │    │
│  └────────────────┬─────────────────────────────────┘    │
└───────────────────┼──────────────────────────────────────┘
                    │
┌───────────────────┼──────────────────────────────────────┐
│  AWS              │                                        │
│  ┌────────────────▼──────────┐  ┌──────────────────────┐ │
│  │  RDS Postgres              │  │  ECS Fargate          │ │
│  │  (jobs, job_events,        │  │  Phase agent          │ │
│  │   messages, approvals,     │◀─│  containers           │ │
│  │   settings, users)         │  │  (on-demand)          │ │
│  └───────────────────────────┘  └──────────────────────┘ │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  S3 — project context wiki (MD files per project)  │   │
│  └────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

## Components

### Next.js App (Vercel)
- Serves kanban UI, approvals page, settings page, ticket creation chat
- API routes handle: project CRUD, job queue management, SSE streams, webhook ingestion
- Vercel Cron job (`* * * * *`) polls Postgres job queue and launches ECS tasks
- Ticket creation conversation: Sonnet via Vercel AI SDK, streamed directly from API route (no ECS per turn)
- Serverless — no always-on process required. SSE connections handled per-request.

### Job Queue (Postgres-based)
- `Job` table tracks all phase work: `QUEUED → RUNNING → COMPLETE | FAILED | BLOCKED | AWAITING_APPROVAL`
- Vercel Cron hits `/api/cron/queue-poller` every minute
- Poller checks: for each phase, if no RUNNING job exists, launch oldest QUEUED job via ECS RunTask
- No Redis, no BullMQ, no always-on worker process

### ECS Fargate (agent runtime)
- Single Docker image: OpenClaw CLI + all MCP servers pre-installed
- On-demand only — spun up by Vercel Cron when job dequeued
- Phase-specific config injected via `OPENCLAW_CONFIG` env var (JSON5 string)
- Container receives: `PROJECT_ID`, `JOB_ID`, `JOB_TOKEN`, `S3_PREFIX`, `OPENCLAW_CONFIG`, `AGENT_PROMPT`, all decrypted secrets
- Agent POSTs progress events to `/api/jobs/{jobId}/events` (bearer token = `JOB_TOKEN`)
- Agent reads/writes S3 context files directly via S3 MCP server
- Agent exits on completion or blocker — no shutdown hook needed

**All autonomous phases (ticket context build, research, generation, maintain) are one-shot ECS tasks.** Ticket creation conversation turns run in Vercel API routes (Sonnet via AI SDK), not ECS.

### OpenClaw Tool Infrastructure
Single Docker image has all MCP servers installed. Phase config selects which are active:

| Phase | MCP Servers |
|-------|-------------|
| ticket-context-build | filesystem, s3, tavily |
| research | filesystem, s3, tavily, bash |
| generation | filesystem, s3, bash, github |
| maintain-seo | filesystem, s3, playwright, github |
| maintain-incident | filesystem, s3, bash, github |

All phases use Nemotron 3 Super 120B via `https://integrate.api.nvidia.com/v1` (OpenAI-compatible).

### RDS Postgres (metadata store)

Tables:
- `User` — single seeded admin row (email + bcrypt hash). Auth: JWT in httpOnly cookie.
- `Project` — id, name, description, status (READY/RESEARCH/GENERATION/MAINTAIN/ARCHIVED), s3Prefix, timestamps
- `Job` — id, projectId, phase (TICKET_CONTEXT_BUILD/RESEARCH/GENERATION/MAINTAIN_SEO/MAINTAIN_AEO/MAINTAIN_INCIDENT), status, ecsTaskArn, jobToken (unique CUID — authenticates agent callbacks), timestamps
- `JobEvent` — id, jobId, type (progress/blocker/approval_request/complete/error), message, metadata (JSON), createdAt
- `Message` — id, projectId, role (user/assistant), content, turn, metadata, createdAt
- `Approval` — id, projectId, jobId (nullable), title, description, type, metadata, status (PENDING/APPROVED/REJECTED), timestamps
- `Setting` — id, key (unique), value (AES-256 encrypted) — global secrets: NVIDIA_API_KEY, REDDIT_API_KEY, etc.

### S3 (Context Engine store)
Structure per project — seeded files + agent-created wiki:
```
projects/
  {project-id}/
    brief.md                  ← seeded at ticket creation. Immutable.
    platform-constraints.md   ← seeded at ticket creation. Immutable.
    project-context.md        ← front page. Rewritten by ideation + generation. Maintained by maintain only on change.
    index.md                  ← wiki catalog. Agent updates after every write.
    log.md                    ← append-only audit trail. Agent appends every run.
    [everything else]         ← agent-created, agent-named, any folder structure the project needs
```

Agents do NOT pull all files at start. Context Engine loading order:
1. `platform-constraints.md` — always
2. `index.md` — always (tells agent what exists)
3. `project-context.md` — always
4. Additional files — agent pulls selectively based on index

See `08-context-engine.md` for full Context Engine spec.

## Queue Behavior

- One active runner per phase at a time
- Multiple phases can run simultaneously (Project A in research, Project B in generation)
- Blocked jobs stay as `BLOCKED` — not re-queued until user resolves blocker
- Failed jobs: logged in JobEvent, card shows `failed`, manual retry
- Ticket creation conversation turns are **not queued** — handled directly by Vercel AI SDK in API routes

## Secrets Flow

1. User enters secret in settings UI
2. API route encrypts with AES-256, upserts to `Setting` table in Postgres
3. On ECS task spin-up: Vercel Cron/API route reads Settings, decrypts, injects as env vars into ECS RunTask call
4. Secret never written to S3 or logs
5. Agent receives secrets only as in-memory env vars within the container

## External Integrations

| Service | Purpose | Auth method |
|---------|---------|-------------|
| GitHub API | Create repos, push commits, open PRs | Personal access token (user-provided) |
| Vercel | Auto-deploy via GitHub integration | GitHub integration (no separate token needed) |
| Reddit API | Ideation research | API key (user-provided) |
| X API | Ideation research | API key (user-provided) |
| PagerDuty | Prod incident webhooks → maintain agent | Webhook secret (user-provided) |
