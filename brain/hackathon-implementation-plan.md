# AppForge Hackathon Implementation Plan

## Context

AppForge is a single-tenant AI software factory for the NVIDIA hackathon. User gives an idea → agents autonomously research, build, deploy, and maintain it. 4-person team, 7 hours (11am–6pm). Need a working end-to-end demo.

**Existing state:** Next.js 16 scaffolded, Prisma 7 configured (empty schema), docker-compose with Postgres, shadcn UI installed. No real application code yet.

**Key constraint:** 7 hours total. Must prioritize ruthlessly. Demo must show the full lifecycle working — ideation conversation → generation deploying a real app → maintain running at least one audit.

---

## Sprint Plan (7 hours)

### Hour 0–1: Foundation (11am–12pm)

**Goal:** Database schema + API skeleton + basic UI shell. Everyone can build on top of this.

| Task | Owner | Details |
|------|-------|---------|
| Prisma schema | 1 person | All tables from `04-technical-deep-dive.md`: projects, phase_jobs, ideation_messages, job_logs, secrets, approval_requests, artifacts_index |
| API route skeleton | 1 person | All routes from backend structure in `04-technical-deep-dive.md` — stubs returning 200, wired to db |
| UI shell | 1 person | Layout with sidebar nav: Kanban, Approvals, Settings pages. Kanban with 5 columns (empty). Use shadcn components. |
| Agent runner abstraction | 1 person | `src/lib/agent-runner.ts` — abstraction that can invoke OpenClaw/Nemotron. For hackathon: runs as subprocess (not ECS). Takes project context, returns output. |

**Files to create:**
- `prisma/schema.prisma` — full schema
- `src/app/(dashboard)/layout.tsx` — dashboard shell
- `src/app/(dashboard)/page.tsx` — kanban board
- `src/app/(dashboard)/approvals/page.tsx` — approvals inbox
- `src/app/(dashboard)/settings/page.tsx` — API key management
- `src/app/api/projects/route.ts` — CRUD
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/projects/[id]/stream/route.ts` — SSE
- `src/lib/agent-runner.ts` — agent execution abstraction

---

### Hour 1–3: Core Flows (12pm–2pm)

**Goal:** Kanban board works. Projects can be created, moved between phases. Ideation chat panel functional.

| Task | Owner | Details |
|------|-------|---------|
| Kanban board | 1 person | Drag-and-drop cards between columns. Real-time badge updates. Create project modal (name + one-line idea). Wire to API. |
| Ideation chat panel | 1 person | `/projects/[id]/chat` page. Message list + composer. Send message → POST to API → triggers agent. SSE for streaming response. |
| Ideation agent prompt | 1 person | Write the ideation prompt template. Wire to agent-runner. Agent does market research via web search, responds conversationally, writes context files. |
| S3/context engine | 1 person | `src/lib/context.ts` — for hackathon, use local filesystem (`./projects/{id}/`) instead of S3. Same file structure (brief.md, index.md, project-context.md, etc). Seeding logic on project create. |

**Files to create:**
- `src/app/(dashboard)/projects/[id]/chat/page.tsx`
- `src/components/kanban/board.tsx`
- `src/components/kanban/card.tsx`
- `src/components/kanban/column.tsx`
- `src/components/chat/message-list.tsx`
- `src/components/chat/composer.tsx`
- `src/lib/context.ts` — context engine (local FS for hackathon)
- `src/lib/prompts/ideation.ts` — prompt template
- `src/app/api/projects/[id]/ideation/message/route.ts`

---

### Hour 3–4.5: Generation Phase (2pm–3:30pm)

**Goal:** Generation agent can take ideation output and actually build + deploy an app.

| Task | Owner | Details |
|------|-------|---------|
| Generation agent prompt | 1 person | Prompt that reads ideation artifacts, creates GitHub repo, writes code, pushes. Uses Nemotron for code gen. |
| GitHub integration | 1 person | `src/lib/github.ts` — create repo, commit files, push. Uses user's GITHUB_TOKEN from settings. |
| Vercel deploy verification | 1 person | After GitHub push, poll Vercel API for deployment status. Write deployment URL back to context. |
| Phase transition UI | 1 person | Approve button on ideation complete → queues generation. Progress display (SSE streaming logs). |

**Files to create:**
- `src/lib/prompts/generation.ts`
- `src/lib/github.ts`
- `src/lib/vercel.ts`
- `src/app/api/projects/[id]/approve/route.ts`

---

### Hour 4.5–5.5: Maintain Phase (3:30pm–4:30pm)

**Goal:** Maintain agent runs one audit cycle — SEO + opens a PR.

| Task | Owner | Details |
|------|-------|---------|
| Maintain agent prompt | 1 person | Reads deployed URL, crawls with fetch (not full Playwright for hackathon), audits SEO basics, opens PR with fixes. |
| Approvals UI | 1 person | Render approval requests from maintain. Show summary, PR link, approve/reject buttons. |
| Cron trigger | 1 person | Manual "Run Maintain" button for demo (skip actual Vercel Cron). Triggers maintain job. |
| Maintain output display | 1 person | Show audit reports in project detail view. Link to GitHub PRs. |

**Files to create:**
- `src/lib/prompts/maintain.ts`
- `src/components/approvals/approval-card.tsx`
- `src/app/api/cron/maintain/route.ts`

---

### Hour 5.5–6.5: Polish + Demo Prep (4:30pm–5:30pm)

| Task | Details |
|------|---------|
| UI polish | Animations, loading states, error states. Make kanban look great. |
| End-to-end test | Run full flow: create project → ideation chat → approve → generation builds → maintain audits |
| Fix bugs | Whatever broke during integration |
| Demo script | Write the exact demo flow, pre-seed a project if needed for speed |

---

### Hour 6.5–7: Buffer (5:30pm–6pm)

Emergency bug fixes, final touches, submission prep.

---

## Hackathon Simplifications (vs Production Design)

| Production (brain docs) | Hackathon | Why |
|------------------------|-----------|-----|
| ECS Fargate containers | Local subprocess / direct API call | No time to configure ECS |
| S3 for context | Local filesystem `./projects/` | Same structure, no AWS setup |
| BullMQ job queue | Direct async execution | No need for queue with 1 user |
| SSE via Postgres polling | Direct SSE from agent stdout | Simpler, works for demo |
| AES-256 encrypted secrets | Plain env vars / .env.local | Single tenant, demo only |
| PagerDuty webhooks | Manual "trigger maintain" button | Can't demo real incidents |
| Full Playwright crawling | fetch + cheerio for SEO audit | Lighter, faster |
| Per-turn ECS containers (ideation) | Single long-lived process per conversation | Simpler for hackathon |

---

## NVIDIA Nemotron Integration

The hackathon requires NVIDIA Nemotron. Integration points:

1. **Ideation agent** — Nemotron powers the conversational research (market analysis, competitor identification)
2. **Generation agent** — Nemotron generates the application code
3. **Maintain agent** — Nemotron analyzes SEO issues and generates fix PRs

All via OpenClaw CLI which routes to Nemotron as the underlying LLM.

---

## Demo Script (what judges see)

1. **Create project** — "I want a habit tracker app for developers"
2. **Ideation chat** — Agent researches market, asks clarifying questions, user responds 2-3 times, agent finalizes brief
3. **Approve → Generation** — User approves, generation agent creates GitHub repo, writes code, deploys to Vercel
4. **Live app** — Show the deployed habit tracker working on Vercel
5. **Maintain** — Trigger maintain audit. Agent crawls deployed app, finds SEO issues, opens PR with fixes
6. **Approvals** — Show PR in approvals page, approve it

Total demo time: ~5–7 minutes showing the full autonomous lifecycle.

---

## Critical Path (what MUST work)

1. Kanban board with project creation
2. Ideation chat with real Nemotron responses
3. Generation actually deploying something to Vercel
4. At least one maintain PR opened

If time is short, cut in this order: maintain polish → generation tests → ideation multi-turn → kanban drag-and-drop (use buttons instead).

---

## Tech Stack (hackathon)

- **Frontend:** Next.js 16, React 19, Tailwind 4, shadcn/ui
- **Backend:** Next.js API routes, Prisma 7, Postgres (docker-compose)
- **Agent runtime:** OpenClaw CLI with Nemotron
- **Context store:** Local filesystem (same markdown structure as S3 design)
- **External:** GitHub API, Vercel API
- **Deploy AppForge itself:** Local dev server for demo (or Vercel if time permits)

---

## Verification

After implementation:
1. `npm run build` — zero errors
2. `npm run dev` — app loads
3. Create a project → ideation chat works → approve → generation runs → app deploys → maintain opens PR
4. No console errors in browser
5. Demo script runs smooth end-to-end in under 7 minutes
