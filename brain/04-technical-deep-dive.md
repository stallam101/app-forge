# AppForge — Technical Deep Dive

> **Hackathon scope (2026-05-16):** The runtime is **Brev**, not AWS ECS. The "container" referenced in this doc is the OpenClaw process running inside an HTTP server on the Brev instance. The callback protocol (`POST /api/jobs/{jobId}/events` with Bearer JWT-style `JOB_TOKEN`) is unchanged. Only the **Research** phase is wired to a real agent for this hackathon.

## Real-Time Updates (SSE)

Agent progress streams to the UI via Server-Sent Events.

### Flow
```
Brev Agent (OpenClaw HTTP server)
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
- `JOB_TOKEN` is a unique CUID stored on the `Job` row, included in the `POST /run` body sent to the Brev Agent (OpenClaw HTTP server). The Brev HTTP wrapper passes it into the OpenClaw process env.
- On `complete`: updates `Job.status = 'COMPLETE'`
- On `error`: updates `Job.status = 'FAILED'`
- On `blocker`: updates `Job.status = 'BLOCKED'`

### Progress Reporting — Agentic

Agent narrates its own progress using bash MCP to curl the callback URL before each major step. No deterministic checkpoints — Nemotron decides when to report. The agent runs on Brev, so `$APPFORGE_CALLBACK_URL` points back at AppForge.

Prompt instruction baked into every phase:
```bash
# Before each major step:
curl -s -X POST "$APPFORGE_CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"progress\",\"message\":\"Scanning web for competitors...\"}"
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

On "Create Ticket": enqueues a `TICKET_CONTEXT_BUILD` job in Postgres → poller picks it up → Brev agent runs Nemotron via OpenClaw.

## Brev Agent Lifecycle (autonomous phases)

```
1. User moves project to phase (drag card or approve)
2. POST /api/projects/[id]/phase
   a. Creates Job row (status: QUEUED)
   b. Updates Project.status
3. Vercel Cron hits /api/cron/queue-poller every 60s
   (or the user clicks POST /api/jobs/[jobId]/kick for instant demo dispatch)
4. Poller: for each phase, if no RUNNING job exists, find oldest QUEUED job
5. For TICKET_CONTEXT_BUILD and RESEARCH jobs — dispatchToBrev(job):
   a. POST ${BREV_AGENT_URL}/run with body:
      {
        jobId,
        phase,
        projectId,
        callbackUrl: APPFORGE_BASE_URL,
        callbackToken: job.jobToken,
        brief: "<contents of brief.md>"
      }
   b. Update Job.status = RUNNING
6. For GENERATION and MAINTAIN_* jobs (1-hour scope) — skip dispatch:
   a. Mark Job.status = BLOCKED
   b. Insert JobEvent:
      { type: "blocker",
        message: "Configure {GitHub|Vercel} token in Settings to enable this phase" }
   No call to Brev is made.
7. Brev HTTP server receives /run:
   a. Spawns OpenClaw with the phase prompt + brief
   b. Streams stdout, parses key events, forwards to callback
8. OpenClaw runs autonomously:
   a. Reads context via filesystem MCP (or s3 MCP if configured)
   b. Calls Nemotron 3 Super 120B at https://integrate.api.nvidia.com/v1
   c. Uses tools (tavily web search, file_write, fetch)
   d. POSTs progress events to $APPFORGE_CALLBACK_URL/api/jobs/$JOB_ID/events
      with Bearer $JOB_TOKEN
   e. On blocker: POSTs { type: "blocker", ... }, then exits
   f. On complete: POSTs { type: "complete", ... }, then exits
9. SSE pushes events to the browser in real-time
```

## OpenClaw MCP Tool Configuration

Phase configs live on the Brev instance at `/workspace/configs/openclaw/{phase}.json` — they are not injected via container env. The Brev instance has all MCP servers pre-installed; the config determines which are active.

Model config (all phases):
```json5
model: {
  provider: "openai-completions",
  baseUrl: "https://integrate.api.nvidia.com/v1",
  apiKey: "${NVIDIA_API_KEY}",
  model: "nvidia/nemotron-3-super-120b-a12b",
}
```

MCP servers by role:
- **filesystem** — always loaded; rooted at the active project workspace.
- **tavily** — research phase; web search via `TAVILY_API_KEY`.
- **fetch** — research phase; HTTP fetch for URLs surfaced by search.
- **s3** — optional. Only loaded when AWS creds are present on the Brev instance. Falls back to **filesystem** otherwise (same path layout, local `/workspace/context`).

Hackathon Research-phase MCP servers:
```json5
mcpServers: {
  filesystem: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace/projects/${PROJECT_ID}"]
  },
  tavily: {
    command: "npx",
    args: ["-y", "tavily-search-mcp"],
    env: { TAVILY_API_KEY: "${TAVILY_API_KEY}" }
  },
  fetch: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"]
  }
}
```

Long-term (post-hackathon) MCP servers — github, playwright, bash — are documented in the phase docs but not wired this hackathon.

## Blocker Protocol

When OpenClaw hits a hard stopper:
1. POSTs `{ type: "blocker", message: "...", metadata: { required: "TAVILY_API_KEY" } }` to callback URL
2. OpenClaw process exits
3. API route updates `Job.status = 'BLOCKED'`
4. SSE pushes blocker event to browser
5. Kanban card turns red (`border-[#ef4444]`)

On user resolution:
1. User enters missing info (API key, decision) via card modal
2. API route updates `Setting` (if API key), creates a new `Job` row (status: QUEUED) with resolution context appended to the prompt
3. Poller picks up the new job, dispatches to Brev again

**Hackathon note:** Generation and Maintain phases auto-blocker on the AppForge side without even dispatching to Brev. The blocker message is `"Configure {GitHub|Vercel} token in Settings to enable."`

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
          kick/route.ts             ← POST: one-click dispatch without waiting on cron (demo)
      approvals/
        route.ts                    ← POST: agent creates approval request
        [id]/route.ts               ← PATCH: approve/reject
      webhooks/
        pagerduty/route.ts          ← POST: incoming PagerDuty events → priority MAINTAIN_INCIDENT job
      cron/
        queue-poller/route.ts       ← GET: poller — dispatches queued jobs to Brev (RESEARCH only this hackathon)
  middleware.ts                     ← protect all routes except /login and /api/auth/*
  lib/
    db.ts                           ← Prisma v7 singleton (PrismaPg adapter)
    auth.ts                         ← JWT sign/verify (jose), getCurrentUser, createSession
    secrets.ts                      ← AES-256 encrypt/decrypt (Node.js crypto)
    s3.ts                           ← S3 client (unused in hackathon — local FS on Brev instead)
    agent-runner.ts                 ← dispatchToBrev() — HTTP POST to Brev agent /run
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
