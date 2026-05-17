# Built-in Incident Detection

**Status:** spec — not yet implemented
**Goal:** replace the "user must sign up for PagerDuty/Better Stack" path with a self-contained health check that fires the existing `MAINTAIN_INCIDENT` pipeline.

This is the **PagerDuty substitute**. PagerDuty (and any future external provider) remains supported via `/api/webhooks/pagerduty` for users with existing alerting setups — but the default flow no longer requires any external signup.

---

## Decisions locked in

| Decision | Choice | Why |
|---|---|---|
| Monitor scope | All `Project` rows where `status = MAINTAIN` AND deploy URL is set | Zero per-project config; opt-out is "don't be in MAINTAIN" |
| Health depth | `200 OK` liveness only (no DB/deps check) | Generated apps may not have DBs; avoids false positives from flaky third-party deps |
| Cron cadence | Every 5 minutes | Matches "small fire" expectation, well under 60 invocations/hr |
| Health endpoint contract | `GET /api/health` returns `200` if process is up | Standard convention; minimal generation-prompt change |
| Idempotency | No new `MAINTAIN_INCIDENT` job if one already exists for project in `QUEUED`/`RUNNING`/`AWAITING_APPROVAL` | Prevents 60 incident jobs/hr during an outage |

---

## Prerequisite (blocks everything else)

**`Project` has no `deployUrl` column today.** The Vercel deployment URL is currently only persisted in:
- `{S3_PREFIX}/project-context.md` (S3, not queryable)
- The `approval_request` event metadata from the generation agent's step 17 (`configs/prompts/generation.md:77`)

The cron needs a queryable URL. **Pick one** before starting:

**Option A — Add `Project.deployUrl` column (recommended).**
- New migration: `ALTER TABLE "Project" ADD COLUMN "deployUrl" TEXT;`
- Update `src/app/api/jobs/[id]/events/route.ts` (or wherever `approval_request` events are persisted) to write the URL onto the Project when `metadata.type === "PHASE_TRANSITION"` and `metadata.deployUrl` is present.
- Backfill: one-time query of past approval events to populate existing rows.

**Option B — Read from latest GENERATION approval event at cron time.**
- No migration. Cron joins `Project` → most recent `JobEvent` of type `approval_request` with `metadata.deployUrl`.
- Slower; adds query complexity per project per poll.
- Acceptable for <50 projects.

The rest of this doc assumes **Option A**.

---

## Files to create / modify

### 1. Prisma migration — add `deployUrl`

**File:** `prisma/migrations/<timestamp>_add_project_deploy_url/migration.sql`

```sql
ALTER TABLE "Project" ADD COLUMN "deployUrl" TEXT;
```

**File:** `prisma/schema.prisma` — add to `model Project`:
```prisma
deployUrl  String?
```

### 2. Persist `deployUrl` on approval

**File:** `src/app/api/jobs/[id]/events/route.ts` (the route the agent posts events to).

In the branch that handles `approval_request` with `metadata.type === "PHASE_TRANSITION"`, after creating the `JobEvent`:

```typescript
const deployUrl = typeof event.metadata?.deployUrl === "string"
  ? event.metadata.deployUrl
  : null
if (deployUrl) {
  await db.project.update({
    where: { id: job.projectId },
    data: { deployUrl },
  })
}
```

### 3. Health-check cron route

**File:** `src/app/api/cron/health-check/route.ts` (new)

Model it on `src/app/api/cron/queue-poller/route.ts`:
- Same `Bearer ${process.env.CRON_SECRET}` auth (lines 16-19 of queue-poller).
- GET handler.
- Returns JSON results array.

Pseudocode:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { dispatchToBrev } from "@/lib/agent-runner"

const HEALTH_TIMEOUT_MS = 10_000

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const projects = await db.project.findMany({
    where: { status: "MAINTAIN", deployUrl: { not: null } },
    select: { id: true, name: true, deployUrl: true, s3Prefix: true },
  })

  const results = await Promise.all(projects.map(async (p) => {
    // Idempotency guard — skip if an incident job is already in flight.
    const inFlight = await db.job.findFirst({
      where: {
        projectId: p.id,
        phase: "MAINTAIN_INCIDENT",
        status: { in: ["QUEUED", "RUNNING", "AWAITING_APPROVAL"] },
      },
      select: { id: true },
    })
    if (inFlight) return { projectId: p.id, skipped: `incident job ${inFlight.id} already in flight` }

    // Liveness check.
    let ok = false
    let detail = ""
    try {
      const res = await fetch(`${p.deployUrl}/api/health`, {
        method: "GET",
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      })
      ok = res.ok
      detail = `status=${res.status}`
    } catch (err) {
      detail = err instanceof Error ? err.message : String(err)
    }

    if (ok) return { projectId: p.id, healthy: true, detail }

    // Down — fire MAINTAIN_INCIDENT.
    const job = await db.job.create({
      data: {
        projectId: p.id,
        phase: "MAINTAIN_INCIDENT",
        status: "QUEUED",
        metadata: {
          trigger: "healthcheck",
          incident: {
            id: `healthcheck-${Date.now()}`,
            title: `Health check failed for ${p.name}`,
            urgency: "high",
            status: "triggered",
            detail,
            checkedUrl: `${p.deployUrl}/api/health`,
            occurredAt: new Date().toISOString(),
          },
        },
      },
    })

    void Promise.resolve().then(() =>
      dispatchToBrev(job.id, "MAINTAIN_INCIDENT", p.id).catch(async (err) => {
        await db.job.update({ where: { id: job.id }, data: { status: "FAILED" } })
        await db.jobEvent.create({
          data: { jobId: job.id, type: "error", message: `Brev dispatch failed: ${String(err)}` },
        })
      }),
    )

    return { projectId: p.id, jobId: job.id, detail }
  }))

  return NextResponse.json({ ok: true, checked: results.length, results })
}
```

### 4. Register the cron

**File:** `vercel.json` — add to `crons` array:

```json
{
  "path": "/api/cron/health-check",
  "schedule": "*/5 * * * *"
}
```

### 5. Generation prompt — instruct agent to scaffold `/api/health`

**File:** `configs/prompts/generation.md`

Insert a new step after step 8 (after "Implement the features listed in brief.md"):

> 8a. **MANDATORY** Create `src/app/api/health/route.ts` returning `200 OK`:
> ```typescript
> import { NextResponse } from "next/server"
> export async function GET() {
>   return NextResponse.json({ ok: true })
> }
> ```
> This endpoint is polled by AppForge's built-in health monitor every 5 minutes once the app is promoted to MAINTAIN. Do not gate it on auth and do not add DB checks — it must respond `200` as long as the process is up.

Add a line to the **Exit Checklist** at the bottom:
> - [ ] `/api/health` route returns 200

### 6. (Optional) Maintain UI surfacing

**File:** `src/app/(dashboard)/projects/[id]/maintain-view.tsx`

Show "Last health check: 2 min ago • Healthy" using the existence (or absence) of recent `MAINTAIN_INCIDENT` jobs. Defer if out of scope.

---

## Idempotency contract

Two layers, both essential:

1. **Cron-level:** the `inFlight` query skips projects with an active incident job. Without this, a 1-hour outage = 12 duplicate jobs.
2. **Resolution:** when the incident-fix PR merges (`auto-merge.ts` already excludes incident PRs from auto-merge), the job moves to `COMPLETED`. The next cron tick that finds the app still down will create a *new* job — this is intentional. Repeated failures after a "fix" attempt represent new information.

---

## Failure modes & expected behavior

| Scenario | Behavior |
|---|---|
| App returns 500 | New `MAINTAIN_INCIDENT` job, agent dispatched |
| App times out (>10s) | Same as 500 |
| App returns 200 but DB is broken | **Not detected** (deliberate — see "Decisions locked in"). User can layer Better Stack/PagerDuty on top if they want deeper checks |
| Vercel deployment URL DNS-fails | New incident job, `detail` field will show DNS error |
| Cron itself fails | Vercel surfaces it in cron logs; no auto-recovery — manual investigation |
| Project not in MAINTAIN | Skipped (cron query filter) |
| Project in MAINTAIN but `deployUrl` is null | Skipped (cron query filter) — user needs to redeploy through generation flow for the URL to backfill |

---

## Verification steps

1. Run migration: `npx prisma migrate dev --name add_project_deploy_url`
2. Manually `UPDATE "Project" SET "deployUrl" = '<existing-deploy-url>' WHERE id = '<test-project-id>' AND status = 'MAINTAIN';`
3. Hit the cron locally with the secret: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/health-check`
4. Confirm the response shows `healthy: true` for the test project.
5. Point `deployUrl` at a deliberately-broken URL (e.g. `https://httpstat.us/500`). Hit the cron again. Confirm a `MAINTAIN_INCIDENT` job is created.
6. Hit the cron a third time without resolving. Confirm the second call returns `skipped: "incident job ... already in flight"` and **no** duplicate job is created.
7. Generate a new app through the full pipeline. Confirm the generation agent creates `/api/health` and that it returns 200 post-deploy.

---

## Out of scope (followups)

- **Project.deployUrl backfill UI** — let users paste a URL for legacy projects whose generation predates this change.
- **Configurable health path** — some users may want `/healthz` or `/_status`; currently hardcoded to `/api/health`.
- **Incident timeline UI** (was task #4 in the inventory) — depends on this landing first.
- **Generic external webhook** (was task #3) — `/api/webhooks/incident` for Better Stack / UptimeRobot. Worth doing once users ask, not before.

---

## Source files this doc must stay aligned with

- `prisma/schema.prisma` (Project model)
- `src/app/api/cron/queue-poller/route.ts` (cron pattern reference)
- `src/app/api/webhooks/pagerduty/route.ts` (incident-job creation pattern)
- `configs/prompts/generation.md` (generation agent instructions)
- `vercel.json` (cron registration)
- `src/lib/agent-runner.ts` (`dispatchToBrev` signature)
