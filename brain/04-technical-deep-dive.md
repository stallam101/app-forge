# AppForge — Technical Deep Dive

## Real-Time Updates (SSE)

Agent progress streams to the UI via Server-Sent Events.

### Flow
```
ECS Agent Container
  → POSTs progress event to /api/jobs/{jobId}/events (bearer token auth)
  → API route inserts JobEvent row in Postgres
  → Browser SSE connection (GET /api/jobs/{jobId}/stream) polls JobEvent table
  → Streams new events to browser as SSE messages
  → Kanban card updates in real-time
```

### Why SSE over WebSockets
- SSE is unidirectional (server → client) — fits the use case exactly
- Native browser support, no library needed
- Works over HTTP/2, handles reconnection automatically

### SSE Endpoint
`GET /api/jobs/[jobId]/stream`
- ReadableStream that polls `JobEvent` table every 1.5s for rows with `id > lastEventId`
- Closes stream on `complete` or `error` event type, or client disconnect
- Auth: JWT cookie (standard user auth, not job token)

### Agent Callback
`POST /api/jobs/[jobId]/events`
- Agent sends: `{ type, message, metadata }` with `Authorization: Bearer {JOB_TOKEN}`
- `JOB_TOKEN` is a unique CUID stored on the `Job` row, injected into ECS task env vars at launch
- On `complete`: updates `Job.status = 'COMPLETE'`
- On `error`: updates `Job.status = 'FAILED'`
- On `blocker`: updates `Job.status = 'BLOCKED'`

### Progress Reporting — Agentic

Agent narrates its own progress using bash MCP to curl the callback URL before each major step. No deterministic checkpoints — Nemotron decides when to report.

Prompt instruction baked into every phase:
```bash
# Before each major step:
curl -s -X POST "$APPFORGE_CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"progress\",\"message\":\"Scanning Reddit for freelancer pain points...\"}"
```

Event types:
- `progress` — narrative update, shown on kanban card activity line
- `blocker` — hard stopper, agent exits, card turns red
- `approval_request` — agent pauses, creates Approval row, waits for user
- `complete` — phase done, card moves to awaiting approval
- `error` — unrecoverable failure

### JobEvent Table
```
id          cuid primary key
jobId       cuid → Job
type        enum: progress | blocker | approval_request | complete | error
message     text
metadata    json? (e.g. PR URL, required key name, approval details)
createdAt   timestamptz
```

## Ticket Creation Conversation (per user message)

Ticket creation chat uses **Vercel AI SDK + Sonnet** directly in a Next.js API route. No ECS container per turn.

```
1. User types in Chat Panel, clicks Send (or first turn auto-fires on page load)
2. POST /api/projects/[id]/chat
   a. Load existing messages from Postgres (Message table)
   b. Save new user message to Message table
   c. streamText({ model: claude-sonnet-4-6, messages, system: ticket-creation-prompt })
   d. Stream response to browser via result.toDataStreamResponse()
   e. Save assistant reply to Message table after stream completes
3. Browser renders streamed message via useChat hook (ai/react)
4. Context panel polls GET /api/projects/[id]/context-files every 3s
```

No BullMQ, no ECS, no queue for conversation turns. Conversation is live server-side streaming.

On "Create Ticket": enqueues a `TICKET_CONTEXT_BUILD` job in Postgres → Vercel Cron picks it up → ECS task runs Nemotron via OpenClaw.

## Container Lifecycle (autonomous phases)

```
1. User moves project to phase (drag card or approve)
2. POST /api/projects/[id]/phase
   a. Creates Job row (status: QUEUED, phase: RESEARCH|GENERATION|MAINTAIN_*)
   b. Updates Project.status
3. Vercel Cron hits /api/cron/queue-poller every 60s
4. Poller: for each phase, if no RUNNING job exists, find oldest QUEUED job
5. API route (launchECSTask):
   a. Load Job + Project from Postgres
   b. Decrypt all Setting rows (AES-256)
   c. Read phase config from configs/openclaw/{phase}.json
   d. Read prompt template from configs/prompts/{phase}.md, inject PROJECT_ID, S3_PREFIX, JOB_ID
   e. ECS RunTask:
      - Single task definition (all phases share one image)
      - launchType: FARGATE
      - Environment vars: JOB_ID, PROJECT_ID, JOB_TOKEN, S3_PREFIX, OPENCLAW_CONFIG (JSON string),
        AGENT_PROMPT, APPFORGE_CALLBACK_URL, all decrypted secrets
   f. Update Job.status = RUNNING, Job.ecsTaskArn
6. Container starts (entrypoint.sh):
   a. Writes $OPENCLAW_CONFIG to /workspace/openclaw.json
   b. Writes $AGENT_PROMPT to /workspace/prompt.md
   c. Runs: openclaw --config /workspace/openclaw.json --prompt /workspace/prompt.md
7. OpenClaw runs autonomously:
   a. Uses S3 MCP server to read context files (platform-constraints.md → index.md → project-context.md → selective)
   b. POSTs progress events to $APPFORGE_CALLBACK_URL/api/jobs/$JOB_ID/events with Bearer $JOB_TOKEN
   c. Writes output files via S3 MCP server
   d. On blocker: POSTs { type: "blocker", message, metadata: { required: "key_name" } }, then exits
   e. On complete: POSTs { type: "complete", message }, then exits
8. SSE pushes events to browser in real-time
```

## OpenClaw MCP Tool Configuration

Phase config is a JSON5 file (`configs/openclaw/{phase}.json`) injected via `OPENCLAW_CONFIG` env var. The Docker image has all MCP servers pre-installed; the config determines which are active.

Model config for all phases:
```json5
model: {
  provider: "openai-completions",
  baseUrl: "https://integrate.api.nvidia.com/v1",
  apiKey: "${NVIDIA_API_KEY}",
  model: "nvidia/nemotron-3-super-120b-a12b",
}
```

MCP server examples:
```json5
mcpServers: {
  s3: {
    command: "npx",
    args: ["-y", "mcp-s3"],
    env: {
      AWS_ACCESS_KEY_ID: "${AWS_ACCESS_KEY_ID}",
      AWS_SECRET_ACCESS_KEY: "${AWS_SECRET_ACCESS_KEY}",
      AWS_REGION: "${AWS_REGION}",
      S3_BUCKET: "${S3_BUCKET_NAME}",
    }
  },
  github: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}" }
  },
  playwright: {
    command: "npx",
    args: ["-y", "@executeautomation/mcp-playwright"],
    env: { PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright" }
  },
  bash: {
    command: "npx",
    args: ["-y", "mcp-bash"]
  },
  tavily: {
    command: "npx",
    args: ["-y", "tavily-search-mcp"],
    env: { TAVILY_API_KEY: "${TAVILY_API_KEY}" }
  }
}
```

## Blocker Protocol

When OpenClaw hits a hard stopper:
1. POSTs `{ type: "blocker", message: "...", metadata: { required: "REDDIT_API_KEY" } }` to callback URL
2. Container exits
3. API route updates `Job.status = 'BLOCKED'`
4. SSE pushes blocker event to browser
5. Kanban card turns red (`border-[#ef4444]`)

On user resolution:
1. User enters missing info (API key, decision) via card modal
2. API route updates Setting (if API key), re-creates Job row (status: QUEUED) with resolution context in prompt
3. Cron picks up new job, relaunches ECS task

## Backend Structure (Next.js App Router)

```
src/
  app/
    (dashboard)/
      layout.tsx                    ← auth guard, shell layout
      page.tsx                      ← kanban board
      projects/
        new/page.tsx                ← ticket creation chat
      approvals/page.tsx
      settings/page.tsx
    login/page.tsx
    api/
      auth/
        login/route.ts              ← POST: bcrypt compare → JWT cookie
        logout/route.ts             ← POST: clear cookie
        me/route.ts                 ← GET: current user
      projects/
        route.ts                    ← GET list, POST create
        [id]/
          route.ts                  ← GET, PATCH
          chat/route.ts             ← POST: stream Sonnet (ticket creation conversation)
          context-files/route.ts    ← GET: list S3 context files
          create-ticket/route.ts    ← POST: enqueue TICKET_CONTEXT_BUILD job
          phase/route.ts            ← POST: transition phase → QUEUED job
      jobs/
        [jobId]/
          events/route.ts           ← POST: agent callback (bearer token)
          stream/route.ts           ← GET: SSE stream of job events
          status/route.ts           ← GET: poll job status
      approvals/
        route.ts                    ← POST: agent creates approval request
        [id]/route.ts               ← PATCH: approve/reject
      webhooks/
        pagerduty/route.ts          ← POST: incoming PagerDuty events → priority MAINTAIN_INCIDENT job
      cron/
        queue-poller/route.ts       ← GET: Vercel Cron, launches queued ECS tasks
  middleware.ts                     ← protect all routes except /login and /api/auth/*
  lib/
    db.ts                           ← Prisma v7 singleton (PrismaPg adapter)
    auth.ts                         ← JWT sign/verify (jose), getCurrentUser, createSession
    secrets.ts                      ← AES-256 encrypt/decrypt (Node.js crypto)
    s3.ts                           ← S3 client + put/get/list helpers
    ecs.ts                          ← launchECSTask() — RunTask wrapper
    utils.ts                        ← cn() classname merger
  types/
    index.ts                        ← shared TS types (ProjectStatus, JobPhase, etc.)
  components/
    layout/
      sidebar.tsx
      shell.tsx
    dashboard/
      status-badge.tsx
      project-card.tsx
      ready-shelf.tsx
      kanban-column.tsx
      kanban-board.tsx
    chat/
      message-list.tsx
      message-bubble.tsx
      typing-indicator.tsx
      composer.tsx
    context-panel/
      context-panel.tsx
      context-file-item.tsx
```

## Auth

- Single admin user row in Postgres (`User` table), seeded via `prisma db seed`
- Login: `POST /api/auth/login` — bcrypt compare, sign 7-day JWT, set httpOnly cookie (`appforge_session`)
- Middleware: verify JWT cookie on all routes except `/login`, `/api/auth/*`, `/api/webhooks/*`
- Env vars needed: `JWT_SECRET` (32-byte base64), `ENCRYPTION_KEY` (32-byte hex), `ADMIN_EMAIL`, `ADMIN_PASSWORD`

## Platform Constraints Injection

`platform-constraints.md` is seeded into S3 at project creation. Agents load it first on every run.

For Vercel:
```markdown
# Platform Constraints — Vercel

## Supported
- Next.js, React, Vue, Svelte, Angular (static + SSR)
- Serverless functions: Node.js (max 60s), Python, Edge Runtime (max 25MB)
- Vercel Postgres (Neon), Vercel Blob, Vercel KV (Upstash Redis)
- Cron jobs via vercel.json

## Not Supported — Do Not Plan or Build
- Long-running background workers or daemons
- Native WebSocket servers (use Ably, Pusher, or Vercel's experimental support)
- Custom Docker runtimes
- Persistent local disk writes
- Self-hosted databases or caches
```
