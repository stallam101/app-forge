# AppForge Brain — Index

Read this file first. Follow links to relevant docs before starting any task.

## Documents

| Doc | What it covers |
|-----|---------------|
| [01-core-idea.md](./01-core-idea.md) | Vision, problem, phases overview |
| [02-interface.md](./02-interface.md) | Kanban UI, user flows, approvals, hard stoppers |
| [03-architecture.md](./03-architecture.md) | AWS stack, infra, data stores, queue system |
| [04-technical-deep-dive.md](./04-technical-deep-dive.md) | SSE, backend structure, container lifecycle, secrets |
| [05-phase-ideation.md](./05-phase-ideation.md) | Ideation agent — inputs, outputs, research flow |
| [06-phase-generation.md](./06-phase-generation.md) | Generation agent — code, GitHub, Vercel, constraints |
| [07-phase-maintain.md](./07-phase-maintain.md) | Maintain agent — SEO, AEO, incidents, cron, confidence |

## Key Decisions (locked)

- **Runtime:** OpenClaw CLI invoked inside ECS Fargate tasks
- **Infra:** AWS — ECS Fargate, S3, RDS Postgres
- **Queue:** BullMQ (one queue per phase)
- **Context store:** S3 — markdown files per project, all pulled on agent start
- **Metadata store:** RDS Postgres — project status, phase state, secrets (encrypted), approvals
- **Container lifecycle:** On-demand spin-up, tear down on completion
- **Phase transitions:** User-approved (drag card or button), not automatic
- **Hard stoppers:** Postgres status update + browser push + red kanban card
- **Auth:** Single hardcoded admin account, JWT session
- **Hosting target for generated apps:** Vercel (platform constraints injected into every agent context)
- **Tenancy:** Single tenant

## Update Protocol

When architecture, interfaces, or agent behavior changes during development:
1. Update the relevant doc(s) above
2. Update this index if a new doc is added
3. Do NOT leave stale decisions — overwrite, don't append
