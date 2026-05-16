import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { launchECSTask } from "@/lib/ecs"
import type { JobPhase } from "@/types"

const PHASES: JobPhase[] = [
  "TICKET_CONTEXT_BUILD",
  "RESEARCH",
  "GENERATION",
  "MAINTAIN_SEO",
  "MAINTAIN_AEO",
  "MAINTAIN_INCIDENT",
]

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Mark stale RUNNING jobs as FAILED (container crashed without posting a final event)
  const staleThreshold = new Date(Date.now() - 15 * 60 * 1000) // 15 minutes
  const staleJobs = await db.job.findMany({
    where: { status: "RUNNING", updatedAt: { lt: staleThreshold } },
    select: { id: true },
  })
  for (const j of staleJobs) {
    await db.job.update({ where: { id: j.id }, data: { status: "FAILED" } })
    await db.jobEvent.create({
      data: { jobId: j.id, type: "error", message: "Job timed out — container may have crashed" },
    })
  }

  const results: { phase: string; launched?: string; skipped?: string; error?: string }[] = []

  for (const phase of PHASES) {
    // Check if any job of this phase is already running
    const running = await db.job.findFirst({
      where: { phase, status: { in: ["RUNNING", "AWAITING_APPROVAL"] } },
    })

    if (running) {
      results.push({ phase, skipped: `job ${running.id} already running` })
      continue
    }

    // Find oldest QUEUED job for this phase
    const queued = await db.job.findFirst({
      where: { phase, status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    })

    if (!queued) {
      results.push({ phase, skipped: "no queued jobs" })
      continue
    }

    try {
      const taskArn = await launchECSTask(queued.id, phase, queued.projectId)
      results.push({ phase, launched: taskArn })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await db.job.update({ where: { id: queued.id }, data: { status: "FAILED" } })
      await db.jobEvent.create({
        data: { jobId: queued.id, type: "error", message: `Launch failed: ${message}` },
      })
      results.push({ phase, error: message })
    }
  }

  return NextResponse.json({ ok: true, results })
}
