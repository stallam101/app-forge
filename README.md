# AppForge

A single-tenant software factory. You give it an idea — even a one-liner — and AppForge takes it through the full lifecycle: research, build, deploy, maintain.

Each phase is powered by an OpenClaw agent running in an isolated ECS Fargate container. You interact with a kanban board, approve phase transitions, and resolve blockers. Otherwise agents run hands-off.

## The Flow

1. **You write a one-line idea.** ("A budgeting app for freelancers.")
2. **Ideation — conversational.** Drag the project to Ideation. The agent opens a chat: initial market research, clarifying questions, niche options. You volley back and forth — each user message fires a fresh container that researches deeper, updates the project wiki, and replies. You or the agent says "finalize" when the brief is ready.
3. **Approve.** Review the finalized product brief, niche, competitors, tech stack, feature list. Approve → hand-off.
4. **Generation — autonomous.** Agent creates a GitHub repo, scaffolds the app, writes code feature-by-feature, runs tests, deploys to Vercel via GitHub integration. No further input unless blocked.
5. **Maintain — autonomous.** Agent runs daily on cron: SEO audits, AEO content, dep updates, performance checks. PagerDuty webhooks trigger immediate incident response. High-confidence changes auto-merge; everything else hits the Approvals inbox.

**Ideation is the only interactive phase.** Everything after is autonomous, with you pulled in only for blockers and approvals.

## Documentation

The full design spec lives in [`brain/`](./brain/index.md). Start there.

| Doc | What it covers |
|-----|---------------|
| [`brain/index.md`](./brain/index.md) | Key decisions, doc map |
| [`brain/01-core-idea.md`](./brain/01-core-idea.md) | Vision, problem, phases overview |
| [`brain/02-interface.md`](./brain/02-interface.md) | Kanban UI, chat panel, approvals, hard stoppers |
| [`brain/03-architecture.md`](./brain/03-architecture.md) | AWS stack, infra, data stores, queue behavior |
| [`brain/04-technical-deep-dive.md`](./brain/04-technical-deep-dive.md) | SSE, container lifecycle (per-turn vs one-shot), backend structure |
| [`brain/05-phase-ideation.md`](./brain/05-phase-ideation.md) | Ideation — conversational, per-turn |
| [`brain/06-phase-generation.md`](./brain/06-phase-generation.md) | Generation — autonomous code + deploy |
| [`brain/07-phase-maintain.md`](./brain/07-phase-maintain.md) | Maintain — SEO, AEO, incidents, cron |
| [`brain/08-context-engine.md`](./brain/08-context-engine.md) | Context Engine — wiki-based context system |

When architecture, interfaces, or agent behavior changes, update the relevant doc — do not leave stale decisions behind.

## Stack

- **Frontend + API:** Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui
- **Database:** RDS Postgres via Prisma 7
- **Queue:** BullMQ (Redis)
- **Agent runtime:** ECS Fargate, OpenClaw CLI
- **Context store:** S3 (per-project markdown wiki)
- **Hosting target for generated apps:** Vercel

## Local Development

Requires Node 24+, Docker, and the AWS CLI configured.

```bash
# Start Postgres (Redis to be added)
docker compose up -d

# Install + generate Prisma client
npm install
npx prisma generate
npx prisma migrate dev

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

See `brain/03-architecture.md` for the full env var list and `brain/04-technical-deep-dive.md` for backend file structure.

## Status

Pre-implementation. Brain docs are locked; code is being scaffolded. Track current build progress against the feature plan in conversation history.
