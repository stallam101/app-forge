import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { dispatchToBrev, BREV_PHASES } from "@/lib/agent-runner"

type Params = { jobId: string }

export async function POST(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { jobId } = await params
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Idempotency guard — only QUEUED jobs can be kicked. Prevents dual-launch race
  // with the 1-min cron poller.
  if (job.status !== "QUEUED") {
    return NextResponse.json(
      { error: "Job is not QUEUED", currentStatus: job.status },
      { status: 409 },
    )
  }

  // Phase guard — only Brev-dispatchable phases. GENERATION + MAINTAIN_* are stubs
  // and should be marked BLOCKED by the cron, not kicked.
  if (!BREV_PHASES.has(job.phase)) {
    return NextResponse.json(
      {
        error: "This phase is stubbed in 1-hour scope",
        phase: job.phase,
        hint: "Configure tokens in Settings to unlock; cron will mark this job BLOCKED.",
      },
      { status: 400 },
    )
  }

  try {
    const { runId } = await dispatchToBrev(jobId, job.phase, job.projectId)
    return NextResponse.json({ ok: true, runId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.job.update({ where: { id: jobId }, data: { status: "FAILED" } })
    await db.jobEvent.create({
      data: { jobId, type: "error", message: `Launch failed: ${message}` },
    })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
