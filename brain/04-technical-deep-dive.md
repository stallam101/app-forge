# AppForge — Technical Deep Dive

## Real-Time Updates (SSE)

Agent progress streams to the UI via Server-Sent Events.

### Flow
```
ECS Container
  → writes status update row to Postgres (job_logs table)
  → Next.js SSE endpoint polls job_logs for new rows
  → streams log lines to browser
  → kanban card updates in real-time
```

### Why SSE over WebSockets
- SSE is unidirectional (server → client) — fits the use case exactly
- Native browser support, no library needed
- Works over HTTP/2, handles reconnection automatically
- WebSockets needed only for bidirectional real-time (not required here)

### SSE Endpoint
`GET /api/projects/[id]/stream`
- Opens SSE connection scoped to a project
- Streams: job status changes, log lines, blocker events, completion events
- Client reconnects automatically on drop (SSE spec)

### job_logs table
```sql
id          uuid primary key
project_id  uuid references projects(id)
job_id      uuid references phase_jobs(id)
phase       text
level       text  -- 'info' | 'warn' | 'error' | 'blocker' | 'complete'
message     text
created_at  timestamptz default now()
```

## Container Lifecycle (detailed)

```
1. User moves project to phase (or phase completes + user approves next)
2. API route creates phase_job record (status: 'queued'), adds to BullMQ queue
3. BullMQ worker picks up job
4. Worker:
   a. Fetches project context file list from S3
   b. Decrypts required secrets from Postgres
   c. Triggers ECS RunTask with:
      - Task definition for phase (ideation|generation|maintain)
      - Environment vars: PROJECT_ID, JOB_ID, AWS_S3_BUCKET, [decrypted secrets]
      - ECS task gets a /tmp volume for working files
5. Container starts:
   a. Downloads Context Engine core files from S3 to /tmp/context/:
      - platform-constraints.md
      - index.md
      - project-context.md
   b. Invokes OpenClaw CLI with task prompt + context path
   c. OpenClaw reads index.md, pulls additional files it needs from S3 on demand
   d. Streams OpenClaw stdout → writes to job_logs via Postgres connection
6. OpenClaw runs autonomously:
   a. Hits blocker → writes BLOCKED record to job_logs, exits with code 2
   b. Completes → writes artifacts to /tmp/output/
7. Container shutdown hook:
   a. If exit code 0: uploads /tmp/output/ to S3, updates job status 'complete'
   b. If exit code 2 (blocker): updates job status 'blocked', no S3 upload
   c. If exit code 1 (error): updates job status 'failed', uploads logs
8. BullMQ worker receives task completion signal via ECS EventBridge
9. SSE stream notifies browser of final status
```

## OpenClaw CLI Integration

Each phase has a task prompt template. The BullMQ worker builds the prompt by:
1. Reading the phase prompt template
2. Injecting phase type + project ID
3. Passing to OpenClaw: `openclaw run --prompt-file /tmp/prompt.md --context-dir /tmp/context/`

OpenClaw handles: LLM calls, tool use, retries, multi-step execution, selective file pulls from S3.
AppForge handles: seeding core context files, secret injection, artifact persistence, status streaming.

Context Engine instructions are baked into every phase prompt — agent knows to read index.md first, pull files selectively, update index + log on exit, rewrite project-context.md only if something changed.

## Blocker Protocol

When OpenClaw determines it cannot proceed without user input:
1. Writes structured JSON to stdout: `{"type":"blocker","reason":"...","required":"api_key|decision|oauth","key_name":"REDDIT_API_KEY"}`
2. Container exits with code 2
3. AppForge parses blocker payload, creates blocker record in Postgres
4. SSE pushes blocker event to browser
5. Kanban card turns red
6. Browser push notification fires

On user resolution:
1. User submits resolution via blocker modal (enters API key, makes decision, etc.)
2. API route stores new secret (if applicable), updates job record with resolution context
3. Job re-queued — new container starts with resolution context in env / context files

## Backend Structure (Next.js App Router)

```
src/
  app/
    (dashboard)/
      page.tsx              ← kanban board
      approvals/page.tsx    ← approval inbox
      settings/page.tsx     ← API keys, platform config
    api/
      projects/
        route.ts            ← GET list, POST create
        [id]/
          route.ts          ← GET, PATCH, DELETE
          stream/route.ts   ← SSE endpoint
          approve/route.ts  ← phase transition approval
          resolve/route.ts  ← blocker resolution
      webhooks/
        pagerdury/route.ts  ← incoming PagerDuty events
      auth/
        route.ts            ← login, session
  lib/
    db.ts                   ← Prisma singleton
    queue.ts                ← BullMQ queues + workers
    s3.ts                   ← S3 client + helpers
    ecs.ts                  ← ECS RunTask wrapper
    secrets.ts              ← encrypt/decrypt helpers
    sse.ts                  ← SSE response helpers
  types/
    index.ts                ← shared types
```

## Auth

- Single admin account — credentials in environment variables (`ADMIN_PASSWORD_HASH`)
- Login → JWT signed with `JWT_SECRET` env var, stored in httpOnly cookie
- Middleware protects all routes except `/api/auth` and `/api/webhooks/pagerdury`
- PagerDuty webhook authenticated via HMAC signature verification (not JWT)

## Platform Constraints Injection

`platform-constraints.md` is generated at task start based on the project's configured hosting provider.

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

This file is injected before any planning or code generation begins.
