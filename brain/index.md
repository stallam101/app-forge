# AppForge Brain — Index

Read this file first. Follow links to relevant docs before starting any task.

> **HACKATHON MODE (2026-05-16):** We are building for the NVIDIA / ASUS / Baskin Cloud Track in 1 hour with 4 people. Single source of truth for what we are shipping right now is **[hackathon-implementation-plan.md](./hackathon-implementation-plan.md)**. The other docs describe the full product vision — treat them as aspirational. When the two conflict, the hackathon plan wins.

## Documents

| Doc | What it covers |
|-----|---------------|
| **[hackathon-implementation-plan.md](./hackathon-implementation-plan.md)** | **READ FIRST.** 4-person, 1-hour plan. File ownership, timeline, demo script. |
| [01-core-idea.md](./01-core-idea.md) | Vision, problem, phases overview |
| [02-interface.md](./02-interface.md) | Dashboard layout, Ready shelf, kanban, ticket creation page, approvals |
| [03-architecture.md](./03-architecture.md) | Compute (Brev), data stores, queue system |
| [04-technical-deep-dive.md](./04-technical-deep-dive.md) | SSE, backend structure, Brev container lifecycle, secrets |
| [05-ticket-creation.md](./05-ticket-creation.md) | Ticket creation — conversational ideation + autonomous context build |
| [05b-phase-research.md](./05b-phase-research.md) | **Research phase — the one real autonomous agent for the hackathon** |
| [06-phase-generation.md](./06-phase-generation.md) | Generation phase — post-hackathon scope (stub in demo UI) |
| [07-phase-maintain.md](./07-phase-maintain.md) | Maintain phase — post-hackathon scope (stub in demo UI) |
| [08-context-engine.md](./08-context-engine.md) | Context Engine — wiki-based context system powering all agents |
| [09-person3-detail-views.md](./09-person3-detail-views.md) | **Person 3 plan:** `/projects/[id]` switch on status + Research SSE view + phase timeline |
| [person4-plan.md](./person4-plan.md) | **Person 4 plan:** approvals, kanban polish, seed, settings, merge, smoke |
| [demo-script.md](./demo-script.md) | ~5 min demo click flow + per-failure fallback narration |
| [design.md](./design.md) | Design system — colors, typography, layout, components, page mockups |

## Key Decisions (locked)

- **Phases:** Ticket creation → Research → Generation → Maintain. User approves every phase transition; never automatic.
- **Hackathon scope (1h):** Research = REAL Brev/OpenClaw/Nemotron (qualifying phase). Generation & Maintain = honest stubs/seed-only. Ticket creation chat = Claude Sonnet via AI SDK (Nemotron swap optional).
- **Infra:** AppForge app on Vercel (or local for hackathon). Agents on Brev.dev GPU instance (OpenClaw HTTP server on :8080). Context on S3 (or local FS on Brev for hackathon). Metadata on Postgres (RDS in prod, docker-compose locally for hackathon).
- **Runtime:** OpenClaw CLI on a Brev.dev instance (all autonomous phases). Wrapped in a small HTTP server that AppForge POSTs to.
- **Container lifecycle:** ticket creation chat = no compute (Sonnet via Vercel AI SDK); ticket context build + research = HTTP POST to Brev agent `/run`, OpenClaw runs Nemotron + tools, posts JobEvents back; generation + maintain = STUB for hackathon (BLOCKED with "Configure token" message).
- **Tool infrastructure:** OpenClaw on Brev with phase-specific configs in `/configs/openclaw/*.json`. Nemotron 3 Super 120B via `https://integrate.api.nvidia.com/v1`.
- **Tools (live tool use):** Tavily web search, file write, fetch.
- **Job dispatch:** Vercel-Cron-style poller (`/api/cron/queue-poller`) POSTs to `${BREV_AGENT_URL}/run`. Agent posts events back to `/api/jobs/{jobId}/events` with `Authorization: Bearer {JOB_TOKEN}`.
- **Auth:** Single user row, bcrypt + JWT in httpOnly cookie. Seeded `demo@appforge.dev` / `demo1234`.
- **Hard stoppers:** `Job.status = BLOCKED` + SSE event + red kanban card border.
- **Tenancy:** single tenant.

### Long-term product vision (post-hackathon, not implemented today)
- All three phases autonomous (Research + Generation + Maintain).
- S3 for context storage; RDS Postgres for metadata.
- AES-256 encrypted secrets in Postgres `Setting` table.
- PagerDuty webhooks for incident-driven Maintain runs.
- Generated apps deploy to Vercel via GitHub integration.

## Update Protocol

When architecture, interfaces, or agent behavior changes during development:
1. Update the relevant doc(s) above.
2. Update this index if a new doc is added.
3. Do NOT leave stale decisions — overwrite, don't append.
4. If a hackathon decision contradicts the long-term vision, document both clearly: "Hackathon: X. Long-term: Y."
