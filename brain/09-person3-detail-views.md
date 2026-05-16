# Person 3 — Project Detail Views (Plan)

> **Owner:** Person 3 — hackathon detail-view track.
> **Goal:** Make `/projects/[id]` switch on `project.status` so every phase has a purpose-built view, with Research as the demo's money shot (live SSE → structured artifacts).
> **Scope:** UI only. Backend wiring (Brev dispatch, SSE event payloads, S3 artifact write) is Person 1 + Person 2. Person 3 consumes existing routes — no new API routes unless absolutely required.

---

## 1. Requirements Restatement

Today `src/app/(dashboard)/projects/[id]/page.tsx` only branches on `READY` sub-states (ticket-build job running → `TicketBuildingView`, failed → `TicketFailedView`, ideation → `IdeationView`). It ignores `RESEARCH | GENERATION | MAINTAIN | ARCHIVED`.

We need:

1. `page.tsx` to switch on `project.status` (top-level), then on job state inside each branch.
2. `ticket-building-view.tsx` to auto-advance once `event.type === "complete"` — already does this via `router.refresh()`. Verify and keep.
3. `project-brief-view.tsx` — render finished brief + an explicit "Send to Research" CTA (renames "Forge"). Wired today but never reached from `page.tsx`.
4. `research-view.tsx` *(new)* — the centerpiece. Streams SSE events from the live Brev/OpenClaw/Nemotron run. Renders:
   - Phase timeline header
   - Live activity feed (left)
   - Streaming artifacts (right): rendered markdown for `research/findings.md`, `research/competitors.md`, citation list
   - "Approve → Generation" CTA when status flips to `AWAITING_APPROVAL`
5. `generation-view.tsx` *(new)* — honest "Configure GitHub token to unlock" CTA. Same layout shell as research, no streaming.
6. `maintain-view.tsx` *(new)* — same pattern; list of seeded approvals + same blocked CTA.
7. `phase-timeline.tsx` *(new)* — horizontal phase pills reused in every detail view.

Non-goals (out of scope for P3):
- Drag-and-drop (already cut).
- Approval mutation (P4 owns approvals page + API).
- Brev dispatch (P2 owns `dispatchToBrev`).
- Writing artifacts (P1 owns; we only render).

---

## 2. Current State Snapshot

| File | Status | Notes |
|---|---|---|
| `projects/[id]/page.tsx` | Exists, narrow | Only handles `TICKET_CONTEXT_BUILD` job states + ideation. No `RESEARCH/GENERATION/MAINTAIN` branches. |
| `ticket-building-view.tsx` | Exists, works | Already auto-advances on `event.type === "complete"`. Keep as-is unless event shape changes. |
| `project-brief-view.tsx` | Exists, unreached | Takes `brief: string` prop. Has "Forge" button hitting `/api/projects/:id/phase` with `{ status: "RESEARCH" }`. Need to wire it into `page.tsx`. |
| `ticket-failed-view.tsx` | Exists | Keep. |
| `ideation-view.tsx` | Exists | Keep — used when project is `READY` and ticket-build job not yet started. |
| `research-view.tsx` | **MISSING** | Build new. |
| `generation-view.tsx` | **MISSING** | Build new. |
| `maintain-view.tsx` | **MISSING** | Build new. |
| `components/phase-timeline.tsx` | **MISSING** | Build new. |

Available primitives we reuse:
- `/api/jobs/[jobId]/stream` — SSE polling endpoint emitting `{ type, message, metadata, createdAt }`.
- `/api/projects/[id]/context-files` — lists S3 keys for a project's prefix; returns `[]` if S3 not configured.
- `getS3Object(key)` — server-only, used inside RSCs to render artifact markdown.
- `StatusBadge` — already maps every status to dot + label.
- `ReactMarkdown` — already used by `project-brief-view`.
- `MessageList` / `Composer` — reusable chat primitives.

---

## 3. Target Architecture: `page.tsx` Switch

`page.tsx` becomes a thin router. Every leaf renders a `*-view.tsx` client component.

```ts
// src/app/(dashboard)/projects/[id]/page.tsx (target shape)
switch (project.status) {
  case "READY":
    if (ticketBuildJob?.status in QUEUED|RUNNING) → <TicketBuildingView />
    if (ticketBuildJob?.status === "FAILED")     → <TicketFailedView />
    if (ticketBuildJob?.status === "COMPLETE")   → <ProjectBriefView brief={...} />
    else                                          → <IdeationView />
  case "RESEARCH":                                → <ResearchView />
  case "GENERATION":                              → <GenerationView />
  case "MAINTAIN":                                → <MaintainView />
  case "ARCHIVED":                                → <ArchivedView /> // optional, can fall back to brief view
}
```

Server-side responsibility per branch:
- For `RESEARCH`: fetch latest `RESEARCH` job (with last N events) and known artifact keys (`research/findings.md`, `research/competitors.md`, `research/market-analysis.md`, etc.) via `getS3Object`. Pass artifact content + job ID into the client view.
- For `GENERATION` / `MAINTAIN`: fetch project + (for maintain) pending approvals. No streaming needed.
- For `READY` + COMPLETE ticket build: fetch `brief.md` from S3 and pass into `ProjectBriefView`.

---

## 4. File-by-File Spec

### 4.1 `src/components/phase-timeline.tsx` (new)

Pure presentational. No data fetching, no state, no SSE. Used everywhere.

```ts
interface PhaseTimelineProps {
  currentPhase: "READY" | "RESEARCH" | "GENERATION" | "MAINTAIN"
  isRunning?: boolean // pulse dot on current pill
  isBlocked?: boolean
}
```

Render four pills horizontally: `Ticket · Research · Generation · Maintain`. Connector lines between them. Completed pills get a check; current pill has a pulsing dot (green if running, red if blocked, purple if awaiting approval); future pills are dimmed.

Visual reference: minimalist stepper. Reuse existing palette — `#22c55e`, `#a855f7`, `#ef4444`, `#555`, `#1a1a1a`.

### 4.2 `src/app/(dashboard)/projects/[id]/research-view.tsx` (new — the money shot)

Client component. Mounts → opens `EventSource`-style fetch to `/api/jobs/{researchJobId}/stream` (same pattern as `ticket-building-view`).

**Props (server passes in):**
```ts
interface ResearchViewProps {
  projectId: string
  projectName: string
  jobId: string
  jobStatus: JobStatus
  initialEvents: ProgressEvent[]              // hydration so user sees history on refresh
  artifacts: { name: string; content: string | null }[]
                                              // pre-fetched on the server from S3
                                              // typical: findings.md, competitors.md,
                                              // market-analysis.md, tech-stack.md
}
```

**Layout (split):**

```
┌── Back row · phase timeline · "Approve → Generation" CTA ──┐
│ ┌────────────────────┬───────────────────────────────────┐ │
│ │ Activity feed      │ Artifacts (tabs / sections)       │ │
│ │ (SSE events,       │ ┌──────────────────────────────┐  │ │
│ │  newest at bottom, │ │ findings.md (rendered MD)    │  │ │
│ │  auto-scrolls)     │ │ competitors.md (matrix)      │  │ │
│ │                    │ │ citations list                │  │ │
│ │                    │ └──────────────────────────────┘  │ │
│ └────────────────────┴───────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Event handling:**
- Reuse the streaming loop from `ticket-building-view`.
- Each event `{ type, message, metadata, createdAt }`:
  - `progress` → append to activity feed
  - `metadata.artifact` (when present, e.g. `metadata: { artifact: "research/competitors.md" }`) → trigger a server fetch via a small `/api/projects/[id]/artifact?key=...` lookup OR keep a polling effect that re-fetches the known artifact set every 4s while running. **Decision: poll every 4s while job is RUNNING.** Simpler and avoids a new API route. Polling stops on `complete`/`error`.
  - `complete` → flip CTA from disabled to "Approve → Generation"; stop poll; `router.refresh()` to pick up the new `project.status` if backend moves it to `AWAITING_APPROVAL`.

**Artifact rendering:**
- `findings.md`, `market-analysis.md`, `tech-stack.md`, `monetization.md`, `reddit-findings.md` → rendered via `ReactMarkdown` with the same prose styles as `project-brief-view`.
- `competitors.md` → render as markdown but with extra class on tables for the "matrix" feel; agent writes a markdown table, we just style it.
- Empty state: "Agent hasn't written this file yet" stub.

**Approve CTA:**
- Visible only when `jobStatus === "AWAITING_APPROVAL"` (or after SSE `complete` flips local state).
- Calls `POST /api/projects/{id}/phase` with `{ status: "GENERATION" }`. (Same pattern as `project-brief-view`.)
- After success, `router.push("/")` so user sees kanban card move.

**Resilience:**
- If `jobId` is undefined (e.g. project somehow `RESEARCH` without a job), render a "Job not started yet — kick run" button that POSTs to `/api/jobs/[jobId]/kick` (built by P2). Sequence: minor — better than blank screen.

### 4.3 `src/app/(dashboard)/projects/[id]/generation-view.tsx` (new — honest stub)

Client component. No streaming. Just renders blocked CTA.

```
┌── Back row · phase timeline ──────────────────────────────┐
│                                                            │
│              [ Generation phase is locked ]                │
│                                                            │
│   To run the Generation agent, configure your GitHub token │
│   in Settings. AppForge needs push access to create the    │
│   generated repo.                                          │
│                                                            │
│              [ Open Settings ] [ Back to brief ]           │
└────────────────────────────────────────────────────────────┘
```

- "Open Settings" → `/settings`.
- "Back to brief" → renders a collapsible accordion below the CTA with the brief + research summary inline (so demo can scroll through what already exists). Optional polish — last if time permits.

### 4.4 `src/app/(dashboard)/projects/[id]/maintain-view.tsx` (new — same pattern, slight twist)

Same blocked CTA as generation-view, but with a header section listing seeded approvals.

For the seeded MAINTAIN project (P4 seeds one) we want the user to see:
- The phase timeline showing Maintain active.
- A "Recent agent activity" panel listing fake-but-plausible run history (read from seeded `JobEvent` rows for that project's MAINTAIN_SEO job).
- A "Pending approvals" list linking out to `/approvals`.
- Below: same "Configure Vercel + GitHub token to unlock new runs" CTA.

Important: copy must be honest — frame it as "seeded demo project showing what Maintain looks like" if there's risk of misleading judges. Coordinate with P4 on seed content.

### 4.5 `src/app/(dashboard)/projects/[id]/page.tsx` (modify)

Convert from `if` chain into `switch (project.status)`.

For `RESEARCH` branch, server-side:

```ts
const researchJob = await db.job.findFirst({
  where: { projectId: id, phase: "RESEARCH" },
  orderBy: { createdAt: "desc" },
  include: { events: { orderBy: { createdAt: "asc" }, take: 200 } },
})

const ARTIFACT_KEYS = [
  "research/findings.md",
  "research/competitors.md",
  "research/market-analysis.md",
  "research/tech-stack.md",
  "research/monetization.md",
  "research/reddit-findings.md",
]

const artifacts = await Promise.all(
  ARTIFACT_KEYS.map(async (k) => ({
    name: k,
    content: await getS3Object(`${project.s3Prefix}/${k}`),
  }))
)
```

For `READY` + ticket-build COMPLETE: fetch `brief.md` from S3 the same way and pass into `ProjectBriefView` (today that view is wired but never reached because the page short-circuits into `IdeationView` with `briefExists: true`).

**Decision: change `READY` branch to render `ProjectBriefView` when `ideationComplete && job?.status === "COMPLETE"`.** Then drop the `briefExists` branching inside `ideation-view.tsx`. Cleaner and matches the user's flow: chat → build → brief → send to research.

### 4.6 `src/app/(dashboard)/projects/[id]/ticket-building-view.tsx` (verify, no changes expected)

Already auto-advances. Sanity check: ensure that after `setTimeout(() => router.refresh(), 800)`, the server reads the new job status as `COMPLETE` and routes to `ProjectBriefView`. If not (race), bump to 1500ms or have the server wait for the job.

### 4.7 `src/app/(dashboard)/projects/[id]/project-brief-view.tsx` (modify slightly)

- Rename CTA from "Forge" to "Send to Research" (matches the brain doc's verbiage). Keep the chevron icon.
- Add the phase timeline (`<PhaseTimeline currentPhase="READY" />`) at the top.
- Keep the existing chat refinement panel — no behavior change.

---

## 5. Data Flow: Research SSE Loop

Diagrammed end-to-end so P3 doesn't have to chase P1/P2 mid-build.

```
User clicks "Send to Research"
   │ POST /api/projects/:id/phase { status: "RESEARCH" }
   ▼
project.status → "RESEARCH"; new Job row created (phase=RESEARCH, status=QUEUED)
   │
   ▼
Vercel-Cron-style poller picks it up → dispatchToBrev(job)
   │ POST {BREV_AGENT_URL}/run { jobId, callbackUrl, callbackToken, brief }
   ▼
OpenClaw / Nemotron loop starts on Brev
   │ For each step, agent POSTs:
   │   /api/jobs/:jobId/events { type, message, metadata }
   │ where metadata may include { artifact: "research/competitors.md" } when a file is written
   ▼
ResearchView (client):
  ① SSE: /api/jobs/:jobId/stream — appends to activity feed
  ② Polls /api/projects/:id/context-files every 4s while jobStatus is RUNNING
     and re-fetches a known set of artifact contents via a small server action
     OR via a new tiny endpoint /api/projects/:id/artifact?key=...
     (decision below)
  ③ On `complete` event → stop poll, flip CTA, router.refresh()
```

### 5.1 Artifact fetching — one new endpoint

We can't avoid this entirely: server components only run on initial load, but artifacts arrive during the live run. We need a way to fetch artifact content client-side. Options:

| Option | Pros | Cons |
|---|---|---|
| A. New route `/api/projects/[id]/artifact?key=...` returning `{ content: string \| null }` | Simple; reuses `getS3Object` | Adds one route |
| B. Embed artifact body in SSE event `metadata.body` | No new route | Bloats SSE payload; couples agent to UI shape |
| C. Use `router.refresh()` after every artifact event | No new code | Refreshes whole page; loses scroll position in activity feed |

**Decision: A.** One thin GET endpoint, opaque to artifact shape, gated to project owner via `getCurrentUser`. ~20 lines.

```ts
// src/app/api/projects/[id]/artifact/route.ts (new — P3 owns this; minimal)
// GET ?key=research/competitors.md
// returns { content: string | null }
```

### 5.2 SSE event shape (contract with P1/P2)

From `events/route.ts` today the agent POSTs `{ type, message, metadata }` and the stream forwards same. P3 needs these `type` values minimum:

- `progress` — generic step
- `tool_use` — optional, but nice for showing "🔍 web_search: best react flashcard apps"
- `artifact_written` — `metadata: { artifact: "research/competitors.md" }` → P3 re-fetches via `/api/projects/:id/artifact?key=...`
- `complete` — terminal
- `error` — terminal

Action item: Sync with P1 at min 30 to lock this. If P1 only emits `progress` and `complete`, P3 falls back to polling artifacts every 4s without the trigger — still works.

---

## 6. Visual Spec — Research View (the demo moment)

Color palette and typography follow `brain/design.md` / existing components (`#0a0a0a` panel, `#1a1a1a` border, `#888` body text, `#fff` headings). Below is intent, not pixel-perfect.

```
┌─ ← Dashboard / Flashcards ─────────  [Approve → Generation] ─┐
│ ●─────●─────○─────○                                          │
│ Ticket  Research  Generation  Maintain                       │
│         ↑ running                                            │
├──────────────────────────────────────────────────────────────┤
│ Activity                       │ Artifacts                   │
│ ─────────                      │ ─────────                   │
│ › Loading product direction... │ [findings] [competitors]    │
│ › 🔍 web_search: med student   │ [market] [tech] [revenue]   │
│   flashcard apps               │                             │
│ › Found 8 competitors          │ ## Competitor Matrix        │
│ › Writing competitors.md       │                             │
│ › Drafting feature list        │ | App     | Strengths | …   │
│ › Writing tech-stack.md        │ | Anki    | Free OSS  | …   │
│ › ✓ Research complete          │ | Quizlet | Brand     | …   │
│                                │                             │
└──────────────────────────────────────────────────────────────┘
```

Activity feed style: monospace-ish, dim gray, `›` prefix (matches `ticket-building-view`). Newest at bottom, autoscroll.

Artifact panel: tabs across the top for each artifact name; selected tab body fills the panel. Highlight the most-recently-updated tab with a subtle green dot.

---

## 7. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **HIGH — SSE event types not yet locked by P1** | Build to current contract (`progress`, `complete`, `error`) + add `artifact_written` listener that simply triggers a re-poll. If P1 doesn't emit it, polling still works. |
| **HIGH — S3 may not be configured at demo time** | All `getS3Object` calls already return `null` on miss. Render "Artifact not available yet" empty state instead of crashing. |
| **MED — `briefExists` short-circuit in `page.tsx` means `ProjectBriefView` is dead code today** | Re-wiring `page.tsx` to render `ProjectBriefView` post-build is part of this PR. |
| **MED — Auto-advance race on ticket build** | Existing 800ms refresh delay. If flaky, bump to 1500ms. |
| **MED — Polling every 4s during research run is wasteful** | Acceptable for hackathon. Production: switch to artifact_written-triggered single fetch. |
| **LOW — Tab state lost on `router.refresh()`** | Track selected tab in `useState`, default to most-recently-updated artifact. |

---

## 8. Implementation Order (P3, 60 min budget)

| Min | Task |
|---|---|
| 0–10 | Scaffold all 4 new view files (empty client components) + `phase-timeline.tsx`. Get `page.tsx` switch compiling against them. Verify build green. |
| 10–25 | Build `research-view.tsx` SSE plumbing (copy from `ticket-building-view`) + activity feed render. Mock artifacts inline. |
| 25–40 | Add `/api/projects/[id]/artifact` route + 4s artifact poll + tab-style artifact panel. Wire "Approve → Generation" CTA. |
| 40–50 | Build `generation-view.tsx` and `maintain-view.tsx` (blocked CTAs). Add phase-timeline to `project-brief-view.tsx` and re-label CTA. |
| 50–60 | E2E smoke: log in, drag through a seeded RESEARCH project, watch SSE render, hit Approve. Fix anything flaky. Merge. |

---

## 9. Test Plan

Playwright (driven by P4 in the final 10 min, but P3 should verify locally):

1. Visit `/projects/{seededResearchProject}` → research-view renders with phase timeline.
2. Open SSE — confirm at least one `progress` event renders into activity feed within 2s.
3. Confirm artifact tabs render at least one tab with markdown content (from seeded data).
4. Click "Approve → Generation" → redirects to `/`.
5. Visit a project in `GENERATION` state → see blocked CTA + working "Open Settings" link.
6. Visit seeded MAINTAIN project → see pending approvals list.
7. `npm run build` — zero type errors.
8. Browser console — zero errors during full flow.

---

## 10. Definition of Done

- [ ] `page.tsx` switches on `project.status` and routes every status to its dedicated view.
- [ ] `phase-timeline.tsx` renders consistently across `project-brief-view`, `research-view`, `generation-view`, `maintain-view`.
- [ ] `research-view.tsx` consumes the SSE stream and renders both the live activity feed and the artifact tabs.
- [ ] Approve → Generation CTA wired and tested.
- [ ] `generation-view.tsx` + `maintain-view.tsx` ship as honest stubs (no fake autonomy).
- [ ] `project-brief-view.tsx` is reachable from `page.tsx` and uses the new CTA copy.
- [ ] `npm run build` green; Playwright golden path green.
- [ ] No new fetched-but-unused props; no `any`; no leftover `console.log`.
