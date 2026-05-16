# AppForge Hackathon Plan (v2 — Brev/OpenClaw/Nemotron, 1h)

## What changed from v1

v1 simulated autonomy with a fake agent runner; that breaks prize eligibility. ECS Fargate is dropped — compute runs on a Brev.dev GPU instance. We don't need real agents for every phase. Research is the qualifier and we make it bulletproof. Generation and Maintain are honest stubs (BLOCKED on missing tokens) and a pre-seeded MAINTAIN project — no faked autonomy.

## Track choices

| Track | Decision | Why |
|---|---|---|
| Cloud Track (Brev + OpenClaw + Nemotron) | YES — primary | Single deliverable unlocks prize eligibility; everything below is in service of this |
| Edge Track (ASUS Ascent GX10) | NO | Hardware ramp-up does not fit a 1h window |
| NemoClaw sandbox | STRETCH | Only if Research is locked at min 40 |
| UCSC special prize | NO | Out of scope for our build |

## Eligibility checklist

- Agent runs on a Brev instance (Cloud Track)
- Uses OpenClaw as the harness (not a custom loop)
- Calls Nemotron via `https://integrate.api.nvidia.com/v1` (build.nvidia.com)
- Demonstrates live tool use — minimum web search + file write
- Demonstrates independent multi-step action — no human in the loop during the run
- Is deployed and running at demo time, not a slideshow

## Architecture

```
User → AppForge (Next.js, local for demo)
         │
         ├─ Ideation chat: Claude Sonnet via @ai-sdk/anthropic
         │   (stretch: swap to Nemotron if <10 min remaining)
         │
         └─ Phase job queued → POST to Brev agent service
                                  │
                                  ▼
                            Brev.dev GPU instance
                              ├─ HTTP server on :8080 (wraps OpenClaw)
                              ├─ OpenClaw daemon
                              │   ├─ LLM: Nemotron 3 Super 120B (build.nvidia.com)
                              │   └─ Tools: web_search (Tavily), file_write, fetch
                              └─ Callback → AppForge /api/jobs/[jobId]/events
                                  (Authorization: Bearer {JOB_TOKEN})
```

Storage: S3 if creds exist, else local `./projects/{id}/` on Brev. Same wiki layout either way.

## Critical risks

- **HIGH — Brev access:** P1 starts immediately; nothing else demos without `BREV_AGENT_URL`
- **HIGH — NVIDIA API key in hand by min 5:** blocks the entire eligibility path; team-wide blocker until resolved
- **HIGH — OpenClaw config + tool wiring is unknown territory:** docs at `nvidia.com/clawhelp` are the source of truth; budget time for trial and error
- **MED — Ideation still uses Claude:** acceptable; the agent running on Brev is the autonomous part the judges evaluate
- **MED — Generation/Maintain as honest stubs, not fake autonomy:** disqualification risk if we fake; we ship "Configure token" BLOCKED states and a seeded MAINTAIN project instead

## File / Task Ownership (4 people, 1 hour)

### Person 1 — Brev / OpenClaw / Nemotron (the prize-eligibility unlock)

Provision Brev instance, install OpenClaw per `nvidia.com/clawhelp`, configure `configs/research.openclaw.json` pointing at `https://integrate.api.nvidia.com/v1` with Nemotron 3 Super 120B, enable tools (`web_search`, `file_write`, `fetch`). Wrap OpenClaw invocation in an HTTP server on :8080 with `POST /run` body `{jobId, phase, projectId, callbackUrl, callbackToken, brief}`. Expose port publicly, share `BREV_AGENT_URL`.

**Deliverable by min 30:** `BREV_AGENT_URL` + `NVIDIA_API_KEY` in `.env` + screenshot of a successful Nemotron research run posting back to the callback.

### Person 2 — AppForge ↔ Brev wiring

- `src/lib/agent-runner.ts` *(new)* — `dispatchToBrev(job)` POSTs to `${BREV_AGENT_URL}/run`
- `src/app/api/cron/queue-poller/route.ts` — replace ECS launch with `dispatchToBrev` for Research; mark Generation and Maintain jobs as `BLOCKED` with message `"Configure {GitHub|Vercel} token in Settings to enable this phase"`
- `src/app/api/jobs/[jobId]/events/route.ts` — verify Bearer-token auth works with what P1 sends
- `src/app/api/jobs/[jobId]/kick/route.ts` *(new)* — one-click demo firing endpoint, no cron wait
- `.env.example` — add `BREV_AGENT_URL`, `NVIDIA_API_KEY`, `NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1`, `TAVILY_API_KEY`

Coordinates with P1 on event payload shape (event types, metadata fields, artifact upload).

### Person 3 — Project detail views (the money shot)

- `src/app/(dashboard)/projects/[id]/page.tsx` — switch on `project.status`
- `src/app/(dashboard)/projects/[id]/ticket-building-view.tsx` — auto-advance on complete
- `src/app/(dashboard)/projects/[id]/project-brief-view.tsx` — render brief + "Send to Research" button
- `src/app/(dashboard)/projects/[id]/research-view.tsx` *(new)* — render real research artifacts streaming via SSE: structured sections, competitor matrix, citations. This is the demo's money shot.
- `src/app/(dashboard)/projects/[id]/generation-view.tsx` *(new)* — honest "Configure GitHub token to unlock" CTA
- `src/app/(dashboard)/projects/[id]/maintain-view.tsx` *(new)* — same pattern
- `src/components/phase-timeline.tsx` *(new)* — horizontal phase pills reused across views

### Person 4 — Approvals, kanban, seed, demo prep, merge

- `src/app/(dashboard)/approvals/page.tsx` — list + Approve / Reject cards
- `src/app/api/approvals/[id]/route.ts` — `PATCH`; on approve, advance phase
- `src/components/kanban/card.tsx` — status colors + last-event one-liner
- `src/components/kanban/board.tsx` — 2s `setInterval` auto-refresh while any project is `RUNNING`
- `prisma/seed.ts` — seed `demo@appforge.dev` / `demo1234`; one project in `MAINTAIN` state with completed brief + research artifacts + 1 `PENDING` approval (so kanban isn't empty at demo start)
- `src/app/(dashboard)/settings/page.tsx` — minimal form: `NVIDIA_API_KEY`, `GITHUB_TOKEN`, `VERCEL_TOKEN`, `TAVILY_KEY` (wired to existing `/api/secrets`)
- `brain/demo-script.md` *(new)* — exact click flow + fallback narration
- Owns merge resolution at min 50 + last-10-min Playwright smoke test

## Timeline

| Min | P1 — Brev | P2 — Wiring | P3 — Detail Views | P4 — Glue |
|---|---|---|---|---|
| 0–10 | Provision Brev, install OpenClaw | Scaffold `dispatchToBrev`, env vars | Scaffold 4 new view files + phase-timeline | Seed user + project skeleton |
| 10–25 | Wire Nemotron + tools, smoke test `POST /run` | Replace ECS launch, kick route, callback auth | research-view streaming from SSE | Approvals page real, settings form |
| 25–40 | HTTP wrapper + callback events | E2E: ticket → brief → dispatch to Brev | brief-view + generation/maintain BLOCKED CTA | Kanban polish + auto-refresh |
| 40–50 | Tighten event payloads with P3 | Help P3 verify events render | Maintain view + loading states | Final seed state + demo script |
| 50–60 | Merge to main, P4 resolves conflicts, `npm run build` green, full smoke test on a fresh seed, lock the demo |

## Demo script (~5 min)

1. Open dashboard — kanban populated by P4 seed, one project in MAINTAIN
2. **+ New Project** → "AI flashcards for med students"
3. 2-turn ideation chat (Claude Sonnet via AI SDK)
4. **Create Ticket** — context build runs (real Brev/OpenClaw call), ticket lands in Ready shelf
5. **Drag to Research** — narrate: *"OpenClaw on Brev kicks in with Nemotron 3 Super."*
6. research-view streams in: real Nemotron output, cited Tavily web search, structured sections — **pause and narrate, this is the eligibility moment**
7. Flip to second monitor: OpenClaw logs on the Brev instance — prove autonomy is live
8. Side panel: open `research/competitor-matrix.md` and `research/findings.md` written by the agent
9. **Approve** → Generation view → honest "Configure tokens to unlock" stub (same harness, gated on GitHub token)
10. **Approvals page** → approve the seeded Maintain SEO PR → kanban updates

## Cut list at min 40

1. Drop Nemotron-for-ideation swap — keep Claude for chat
2. Drop generation-view + maintain-view — replace with bare "Configure tokens to unlock" placeholders, no lock-icon polish
3. Drop drag-and-drop — phase advance via button only
4. Drop NemoClaw sandbox bonus
5. Last resort if Brev breaks at min 55: pre-recorded Brev research run with timestamps, narrated over live Brev logs in a second window

## Production vs hackathon

The brain docs describe the production target (autonomous Research + Generation + Maintain, S3 + RDS, encrypted secrets, deploy pipeline). Each phase doc declares HACKATHON SCOPE (REAL / STUB / SEED-ONLY) at its top. Production design — ECS, RDS, full agent coverage — is roadmap, not 1-hour scope.
