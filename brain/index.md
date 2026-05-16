# AppForge Brain — Index

Read this file first. Follow links to relevant docs before starting any task.

## Documents

| Doc | What it covers |
|-----|---------------|
| [01-core-idea.md](./01-core-idea.md) | Vision, problem, phases overview |
| [02-interface.md](./02-interface.md) | Dashboard layout, Ready shelf, kanban, ticket creation page, approvals |
| [03-architecture.md](./03-architecture.md) | AWS stack, infra, data stores, queue system |
| [04-technical-deep-dive.md](./04-technical-deep-dive.md) | SSE, backend structure, container lifecycle, secrets |
| [05-ticket-creation.md](./05-ticket-creation.md) | Ticket creation — conversational ideation + autonomous context build |
| [05b-phase-research.md](./05b-phase-research.md) | Research phase — autonomous deep market research |
| [06-phase-generation.md](./06-phase-generation.md) | Generation phase — autonomous code, GitHub, Vercel |
| [07-phase-maintain.md](./07-phase-maintain.md) | Maintain phase — SEO, AEO, incidents, cron |
| [08-context-engine.md](./08-context-engine.md) | Context Engine — wiki-based context system powering all agents |
| [design.md](./design.md) | Design system — colors, typography, layout, components, page mockups |

## Key Decisions (locked)

- **Phases:** Research → Generation → Maintain (3 phases). Ideation is ticket creation, not a phase.
- **Ticket creation:** Full-page conversational interface at `/projects/new`. Multi-turn Sonnet chat (Vercel AI SDK, streaming, no ECS per turn) → user submits → autonomous context build (ECS + Nemotron) → ticket appears in Ready shelf.
- **Ready shelf:** Separate section above kanban. Tickets drag from Ready into Research to queue.
- **Kanban columns:** Research | Generation | Maintain | Archived
- **Container lifecycle:**
  - Ticket creation conversation: **no container** — Sonnet via Vercel AI SDK in Next.js API route
  - Ticket creation context build: one-shot ECS (Nemotron via OpenClaw)
  - Research / Generation / Maintain: one-shot ECS (Nemotron via OpenClaw), on-demand spin-up
- **Context split:** `ideation/` = ticket creation outputs. `research/` = Research phase outputs.
- **Runtime:** OpenClaw CLI invoked inside ECS Fargate tasks (all autonomous phases)
- **Infra:** AppForge app on Vercel. Agents on AWS ECS Fargate. Context on S3. Metadata on RDS Postgres.
- **Queue:** Postgres-based job queue (`Job` table) + Vercel Cron poller (every minute). No Redis, no BullMQ.
- **Tool infrastructure:** Single Docker image with all MCP servers. Phase-specific openclaw.json config injected via `OPENCLAW_CONFIG` env var. Nemotron 3 Super 120B via `https://integrate.api.nvidia.com/v1`.
- **Agent callback:** Agent POSTs progress to `/api/jobs/{jobId}/events` with `Authorization: Bearer {JOB_TOKEN}`. No direct DB access from container.
- **Context store:** S3 — Context Engine wiki per project, agent reads/writes via S3 MCP server
- **Metadata store:** RDS Postgres — User, Project, Job, JobEvent, Message, Approval, Setting
- **Phase transitions:** User-approved (drag card or button). Never automatic.
- **Hard stoppers:** Job.status = BLOCKED + SSE event + red kanban card border
- **Auth:** Single user row in Postgres (seeded), bcrypt + JWT in httpOnly cookie
- **Hosting target for generated apps:** Vercel (platform-constraints.md injected into every agent)
- **Tenancy:** Single tenant

## Update Protocol

When architecture, interfaces, or agent behavior changes during development:
1. Update the relevant doc(s) above
2. Update this index if a new doc is added
3. Do NOT leave stale decisions — overwrite, don't append
