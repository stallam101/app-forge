# Current Status — Hackathon Sprint

> Snapshot of where each of the 4 tracks stands. Update this file whenever a deliverable lands or a blocker surfaces. **Source of truth for "are we ready to demo?"**

**Last updated:** 2026-05-16 (P2 ship)

---

## Track Status Summary

| Track | Owner | Status | Confidence |
|---|---|---|---|
| P1 — Brev / OpenClaw / Nemotron | Person 1 | Not started in repo (lives off-repo on Brev instance) | UNKNOWN |
| P2 — AppForge ↔ Brev wiring | Person 2 | **SHIPPED** ✅ — build green | HIGH |
| P3 — Project detail views | Person 3 | In progress (unstaged: `research-view.tsx`, `generation-view.tsx`, `phase-timeline.tsx`, `phase.ts`) | MED |
| P4 — Approvals, kanban, seed, demo, merge | Person 4 | In progress (unstaged: `approvals/page.tsx`, `approvals/[id]/route.ts`, `phase/route.ts`, `types/index.ts`) | MED |

Legend:
- **SHIPPED**: code merged or staged, build green, tested.
- **In progress**: visible work in the tree, not yet verified end-to-end.
- **Not started**: no commits / files yet.
- **BLOCKED**: waiting on another track or external resource.

---

## P1 — Brev / OpenClaw / Nemotron

**Plan:** [person1-plan.md](./person1-plan.md)

### Done
- _(nothing visible in the AppForge repo; P1's work lives on the Brev instance)_

### Outstanding (blocks demo eligibility)
- [ ] Brev instance provisioned + OpenClaw installed
- [ ] `configs/research.openclaw.json` wired to Nemotron 3 Super 120B + Tavily + file_write
- [ ] HTTP wrapper on `:8080` accepting `POST /run`
- [ ] Public URL exposed → shared as `BREV_AGENT_URL`
- [ ] `NVIDIA_API_KEY` + `TAVILY_API_KEY` shared with team
- [ ] At least one end-to-end run posting `complete` callback to AppForge

**Blocks:** entire demo. Without `BREV_AGENT_URL`, P2's dispatcher fails loudly and P3's research-view has nothing to render.

---

## P2 — AppForge ↔ Brev Wiring ✅

**Plan:** [person2-plan.md](./person2-plan.md)

### Done
- [x] `.env.example` — all coordination keys documented
- [x] `src/lib/agent-runner.ts` — `dispatchToBrev()`, `BREV_PHASES`, `STUB_BLOCKER_MESSAGE`
- [x] `src/app/api/cron/queue-poller/route.ts` — Brev dispatch for RESEARCH + TICKET_CONTEXT_BUILD; honest BLOCKED state for GENERATION + MAINTAIN_*
- [x] `src/app/api/jobs/[jobId]/kick/route.ts` — demo-day instant-fire endpoint
- [x] `src/app/api/jobs/[jobId]/events/route.ts` — verified Bearer-token auth matches P1 contract
- [x] `npm run build` green, zero TS errors

### Outstanding
- [ ] End-to-end smoke against P1's real `BREV_AGENT_URL` (blocked on P1)

### Hand-offs delivered
- **To P3:** `JobEvent.metadata.required` carries `"GITHUB_TOKEN" | "VERCEL_TOKEN" | "PAGERDUTY_WEBHOOK"` for the BLOCKED CTA. `POST /api/jobs/{jobId}/kick` available as the "Run Research" insurance button.
- **To P4:** `Job.ecsTaskArn` now holds Brev `runId`. Don't seed QUEUED `MAINTAIN_*` or `GENERATION` jobs (will BLOCKED on next cron tick); seed COMPLETE + PENDING Approval instead.

---

## P3 — Project Detail Views

**Plan:** [person3-plan.md](./person3-plan.md)

### Done (visible in tree, unstaged)
- [x] `src/components/phase-timeline.tsx` — horizontal phase pills component
- [x] `src/app/(dashboard)/projects/[id]/research-view.tsx` — research streaming view
- [x] `src/app/(dashboard)/projects/[id]/generation-view.tsx` — Configure GitHub token CTA
- [x] `src/lib/phase.ts` — likely the extracted STATUS_TO_PHASE helper

### Outstanding
- [ ] `maintain-view.tsx` (not yet visible)
- [ ] `page.tsx` switch on `project.status` (not visible in diff)
- [ ] `project-brief-view.tsx` polish — "Send to Research" CTA copy + phase timeline header
- [ ] Verify research-view consumes P2's BLOCKED metadata correctly
- [ ] Verify SSE plumbing works against P1's event types
- [ ] Optional new route: `/api/projects/[id]/artifact?key=...` for client-side artifact fetches (per plan section 5.1)

### Dependencies
- Needs P1 event-type contract locked before final polish.
- Needs P4 seed data to test rendering without a live agent run.

---

## P4 — Approvals, Kanban, Seed, Demo, Merge

**Plan:** [person4-plan.md](./person4-plan.md)

### Done (visible in tree, unstaged)
- [x] `src/app/(dashboard)/approvals/page.tsx` — real list + Approve/Reject (modified from placeholder)
- [x] `src/app/api/approvals/[id]/route.ts` — PATCH likely now advances phase on approve
- [x] `src/app/api/projects/[id]/phase/route.ts` — touched
- [x] `src/types/index.ts` — touched

### Outstanding
- [ ] `src/components/dashboard/kanban-board.tsx` — switch to 2s gated auto-refresh
- [ ] `prisma/seed.ts` — demo user + MAINTAIN MealPlanner.ai project + brief + research artifacts + PENDING approval
- [ ] `src/app/(dashboard)/settings/page.tsx` — wire to `/api/secrets`
- [ ] `brain/demo-script.md` — exists per `index.md` listing; needs verification
- [ ] Merge resolution at min 50
- [ ] Playwright smoke 50–60

### Dependencies
- Seed file paths under `projects/{id}/research/` must match P3's view expectations.

---

## Cross-Cutting Blockers

| Blocker | Owner | Impact | Resolution |
|---|---|---|---|
| `BREV_AGENT_URL` not shared | P1 | Demo cannot show real autonomous run | Get URL by min 30 |
| `NVIDIA_API_KEY` distributed? | P1 | Settings page can't pre-fill | Share in team channel |
| Ngrok URL for `APPFORGE_BASE_URL` | Whoever runs demo laptop | Brev callbacks fail without it | Run `ngrok http 3000` at min 45 |
| P3 + P4 seed-path alignment | P3 + P4 | research-view renders empty in seeded MAINTAIN project | Sync at min 10 on `projects/{id}/research/*` paths |

---

## Demo Readiness Checklist

The minimum required to do the live demo end-to-end:

- [ ] **P1**: Brev agent running, public URL shared
- [x] **P2**: `BREV_AGENT_URL` consumed in code; FAILED on missing, BLOCKED on stub phases
- [ ] **P3**: research-view rendering live SSE; generation-view + maintain-view rendering BLOCKED CTA
- [ ] **P4**: Seeded MAINTAIN project visible in kanban; approvals page works; settings form wired
- [ ] **All**: `npm run build` green on integration branch
- [ ] **All**: One full dry-run from `+ New Project` → research complete → approve → kanban update
- [ ] **All**: Fallback recording captured (per cut list in [hackathon plan](../hackathon-implementation-plan.md))

---

## Update Protocol

When you ship a deliverable or hit a blocker:

1. Update the relevant "Done" / "Outstanding" / "Blocked" lines in your section.
2. Update the **Track Status Summary** table at the top.
3. Bump **Last updated** with the date.
4. If you discover a new cross-cutting blocker, add a row to **Cross-Cutting Blockers**.
5. Keep entries terse — link to deeper docs rather than duplicating their content.
