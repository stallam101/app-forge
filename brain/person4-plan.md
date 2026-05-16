# Person 4 Plan — Approvals, Kanban, Seed, Demo, Merge

> Hackathon scope. See [hackathon-implementation-plan.md](./hackathon-implementation-plan.md) for global plan. P4 owns the "glue" track — the four pieces below + merge-master + last-10-min smoke. If P4 slips, the demo can't tell a story even if P1/P2/P3 ship.

## Scope

Five build deliverables + two ops deliverables:

| # | Deliverable | Type | Min |
|---|---|---|---|
| 1 | Approvals page (list + Approve/Reject) | build | 0–25 |
| 2 | `PATCH /api/approvals/[id]` advances phase on approve | build | 0–15 |
| 3 | Kanban card status colors + last-event one-liner | build | 10–25 |
| 4 | Kanban board 2s auto-refresh while any project RUNNING | build | 25–30 |
| 5 | Seed: demo user + MAINTAIN project + brief + research artifacts + PENDING approval | build | 0–25 |
| 6 | Settings page wired to `/api/secrets` | build | 25–40 |
| 7 | `brain/demo-script.md` | doc | 40–50 |
| 8 | Merge resolver at min 50 + Playwright smoke 50–60 | ops | 50–60 |

## Current state (verified before plan)

- `src/app/(dashboard)/approvals/page.tsx` — placeholder ("No pending approvals.")
- `src/app/api/approvals/[id]/route.ts` — PATCH exists, updates status only, **does not advance phase**
- `src/app/api/approvals/route.ts` — GET + POST exist (POST is agent-callback via job token)
- `src/components/dashboard/kanban-board.tsx` — already polls every **5s unconditionally** (must change to 2s, gated on RUNNING)
- `src/components/dashboard/project-card.tsx` — already renders status badge + last-event one-liner + red border on BLOCKED/FAILED. **Mostly done.** P4 just verifies + tweaks colors per `status-badge.tsx`.
- `src/components/dashboard/status-badge.tsx` — color map exists; needs `COMPLETE` polish + verify all `JobStatus` covered.
- `src/app/(dashboard)/settings/page.tsx` — placeholder
- `src/app/api/secrets/route.ts` — GET/POST live, AES-256-GCM encrypt working (`src/lib/secrets.ts`)
- `prisma/seed.ts` — seeds user only. Needs project + jobs + events + brief + research artifacts + approval.
- `src/app/api/projects/[id]/phase/route.ts` — `POST { status }` flips project status + creates QUEUED job. **P4 reuses this** from approval PATCH on approve.

## Deliverable specs

### 1. `src/app/(dashboard)/approvals/page.tsx`

Server component. Fetches `await db.approval.findMany({ where: { status: "PENDING" }, include: { project: { select: { name: true } } }, orderBy: { createdAt: "desc" } })`. Renders into a client component `<ApprovalList>` for interactivity.

Card layout (one per approval):
```
┌────────────────────────────────────────────┐
│ [type badge]  Project name · 2m ago        │
│ Title                                      │
│ Description (line-clamp-3, markdown ok)    │
│                            [Reject] [Approve]
└────────────────────────────────────────────┘
```

Action handlers in client component:
- `onApprove` → `PATCH /api/approvals/${id}` body `{ status: "APPROVED" }`, optimistic remove, on success `router.refresh()`.
- `onReject` → same with `status: "REJECTED"`.
- Empty state: same copy as today ("No pending approvals.").

Type badge color: reuse `approvalTypeColor()` helper colocated in the page file (PHASE_TRANSITION = purple, SEO_PR/AEO_PR = blue, INCIDENT_FIX = red, CONTENT_PR/X_POST = green, DEPENDENCY_BUMP = amber).

### 2. `src/app/api/approvals/[id]/route.ts` — PATCH advances phase

Replace the current single `db.approval.update` with this flow inside a `db.$transaction`:

```ts
const approval = await tx.approval.update({
  where: { id },
  data: { status, resolvedAt: new Date() },
})

if (status === "APPROVED" && approval.type === "PHASE_TRANSITION") {
  const meta = approval.metadata as { targetStatus?: ProjectStatus } | null
  const targetStatus = meta?.targetStatus
  if (targetStatus) {
    await tx.project.update({ where: { id: approval.projectId }, data: { status: targetStatus } })
    const phase = STATUS_TO_PHASE[targetStatus]
    if (phase) {
      await tx.job.create({ data: { projectId: approval.projectId, phase, status: "QUEUED" } })
    }
  }
}
```

`STATUS_TO_PHASE` is copy-pasted from `src/app/api/projects/[id]/phase/route.ts` (or extracted to `src/lib/phase.ts` — do this only if no merge conflict, otherwise duplicate). Non-PHASE_TRANSITION approvals (SEO_PR etc.) just resolve; no side effect for the hackathon.

Auth: keep the existing `getCurrentUser()` guard. Don't break P2's job-token POST handler.

### 3. `src/components/dashboard/kanban/card.tsx`

P4 spec calls for a `src/components/kanban/card.tsx`. The existing card lives at `src/components/dashboard/project-card.tsx` and already does ~90% of what's needed. **Decision: do NOT move the file** (would conflict with P3's branch and P4's hour budget). Instead:

- Verify `status-badge.tsx` colors match `brain/02-interface.md`: ready=blue, queued=amber, running=green, blocked=red, awaiting_approval=purple, complete=green, failed=red. Already done.
- Confirm the red border triggers on `BLOCKED || FAILED`. Already done.
- Confirm `activeJob.lastMessage` renders as one-liner with `line-clamp-1`. Already done.
- One-line patch: when status is `AWAITING_APPROVAL`, render a "tap Approvals →" hint under the message. (Optional — only if min 25–40 has headroom.)

### 4. `src/components/dashboard/kanban-board.tsx` — 2s auto-refresh gated on RUNNING

Replace the unconditional `setInterval(..., 5000)` with:

```ts
useEffect(() => {
  const anyRunning = projects.some(
    (p) => p.activeJob?.status === "RUNNING" || p.activeJob?.status === "QUEUED"
  )
  if (!anyRunning) return
  const interval = setInterval(refresh, 2000)
  return () => clearInterval(interval)
}, [projects])
```

Where `refresh` is the existing fetch-and-set-state body extracted to a memoized function. Effect re-subscribes whenever `projects` shape changes (i.e., once a job moves to COMPLETE/AWAITING_APPROVAL the interval clears). Add a `useEffect` mount-only fallback `setTimeout(refresh, 5000)` so an idle board still picks up a newly QUEUED job within 5s. (Or accept the cost: idle boards just don't refresh — user can navigate.)

### 5. `prisma/seed.ts` — demo state

After the user upsert, idempotently seed (use `findFirst` + skip):

1. `demoProject` — `name: "MealPlanner.ai"`, `description: "AI meal planning for busy professionals"`, `status: "MAINTAIN"`, `s3Prefix: "projects/${id}"`.
2. Two completed jobs on `demoProject`:
   - `phase: "TICKET_CONTEXT_BUILD"`, `status: "COMPLETE"`
   - `phase: "RESEARCH"`, `status: "COMPLETE"`
3. Three JobEvents on the research job: `progress`/"Searching market…", `progress`/"Wrote findings.md", `complete`/"Research complete — 4 sections, 12 citations".
4. One `Approval`:
   - `type: "SEO_PR"`, `title: "SEO PR: meta tags + schema.org for /recipes"`, `description: "Adds JSON-LD Recipe schema and dynamic meta tags."`, `status: "PENDING"`, `metadata: { branch: "seo/recipe-schema", diff: "+42 -3" }`.
5. S3/local artifacts — write to `./projects/${id}/` (the same fallback Brev uses per `hackathon-implementation-plan.md`):
   - `brief.md` — populated 5-section brief.
   - `research/findings.md` — 4 markdown sections.
   - `research/competitor-matrix.md` — small table.
   - `research/citations.md` — bullet list with Tavily-style URLs.

   These files are read by P3's `research-view.tsx`. **Coordinate file paths with P3 at min 10.**

The seed script must be re-runnable (idempotent). Guard each insert with a `findFirst`-by-name check. The S3 writes go through `putS3Object` from `src/lib/s3.ts` (already supports local fallback per P2's plan).

### 6. `src/app/(dashboard)/settings/page.tsx`

Client component with controlled form. Four inputs (all `type="password"` with show/hide toggle):

```
NVIDIA_API_KEY     [••••••••] [show]
TAVILY_API_KEY     [••••••••] [show]
GITHUB_TOKEN       [••••••••] [show]
VERCEL_TOKEN       [••••••••] [show]
                              [Save all]
```

On mount: `GET /api/secrets` → show "Configured ✓" pill next to each key that exists. On submit: `POST /api/secrets` with only the non-empty fields. Success toast = inline 3s green text "Saved.". No fancy form library — `useState` per field is fine.

Order matters for demo: NVIDIA_API_KEY first (Research eligibility), GITHUB_TOKEN second (Generation unlock).

### 7. `brain/demo-script.md`

Authored separately (see file). Captures: precondition checklist, exact click sequence with timestamps, what each click should visually do, fallback narration for each failure mode (Brev down, Nemotron slow, Tavily rate-limited).

### 8. Merge + smoke (min 50–60)

**Merge protocol (min 50):**
1. `git fetch --all`
2. Pull each of `feat/person1-brev`, `feat/person2-wiring`, `feat/person3-views`, `feat/person4-glue` into a local `integration` branch in sequence.
3. Conflict heuristic: P3 owns `src/app/(dashboard)/projects/[id]/*`; P4 owns `(dashboard)/approvals/*` + `(dashboard)/settings/*` + `components/dashboard/kanban-*` + `prisma/seed.ts`. Overlap risk = `src/types/index.ts` and `src/components/phase-timeline.tsx`. Resolve by preferring the more recent commit unless types diverge; in that case keep the superset.
4. `npx prisma generate && npm run build` — **must be green before push**.
5. `npm run db:seed` against the demo DB (drop + reseed for clean state).
6. Push `integration` → `main`, all branches deleted post-merge.

**Smoke (min 50–60):** Manual Playwright via the Playwright MCP, not authored tests.

| Step | Expected |
|---|---|
| Login at `/login` with `demo@appforge.dev` / `demo1234` | Redirect to `/` |
| `/` dashboard | Seeded MealPlanner.ai card visible in MAINTAIN column, one PENDING-approval pill |
| Click `+ New Project` → type "AI flashcards for med students" → submit | Lands on `/projects/{id}` ticket-building view |
| Complete 2-turn ideation | Auto-advances to brief view |
| Click "Send to Research" | Card moves to RESEARCH column, status pill = `running`, kanban refreshes within 2s |
| Wait for research complete | Card shows `awaiting approval` purple pill |
| `/approvals` | 1 PHASE_TRANSITION approval visible |
| Click Approve | Card disappears from list; kanban card moves to GENERATION; new approval (seeded one) still PENDING |
| `/settings` | All four fields render, configured pills show ✓ for keys in `.env` |
| Browser console | No red errors throughout |

If anything fails: fix forward, do not roll back. At min 58, freeze the demo state by leaving a known-good project mid-research so judge clicks have a fallback.

## Risks & cut order

| Risk | Likelihood | Mitigation |
|---|---|---|
| Approval PATCH races with poller creating duplicate jobs | LOW | `db.$transaction` + reuse existing STATUS_TO_PHASE |
| Seed file paths drift from P3's view | MED | Sync at min 10, lock paths in this doc, update if changed |
| 2s polling hammers Postgres on local | LOW | Gated on RUNNING; idle = no requests |
| Merge conflict in `src/components/phase-timeline.tsx` | MED | P4 owns conflict resolution; defer to P3's version, P4 adapts |
| Smoke surfaces a P2 wiring bug at min 55 | HIGH | Fallback per `demo-script.md` — pre-recorded Brev terminal in a second window |

**Cut order (if P4 falls behind at min 40):**
1. Drop "Configured ✓" pill on settings (just render the form)
2. Drop secondary `findFirst` idempotency guards in seed (just `prisma migrate reset --force` before demo)
3. Drop 2s auto-refresh (keep 5s unconditional — degrades but works)
4. Drop approval type badge color logic (single neutral pill)
5. **Never cut:** seed MAINTAIN project, PATCH→advance, demo script

## Coordination touchpoints

| Min | With | What |
|---|---|---|
| 5 | P3 | Confirm research artifact file paths under `projects/${id}/research/` |
| 15 | P2 | Confirm `STATUS_TO_PHASE` lives in one place; pick `src/lib/phase.ts` if extracting |
| 30 | P3 | Verify research-view renders seeded `findings.md` even without a live Brev run |
| 45 | All | Branch-freeze announcement — no new commits to feature branches |
| 50 | All | Merge gate — present at integration |
