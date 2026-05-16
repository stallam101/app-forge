import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { launchECSTask } from "@/lib/ecs"
import { STATUS_TO_PHASE } from "@/lib/phase"
import type { ProjectStatus, JobPhase } from "@/types"

type Params = { id: string }

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { status } = await req.json() as { status: ProjectStatus }

  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.project.update({ where: { id }, data: { status } })

  const phase = STATUS_TO_PHASE[status]
  if (phase) {
    const job = await db.job.create({
      data: { projectId: id, phase, status: "QUEUED" },
    })

    // Launch immediately — no cron needed
    void launchECSTask(job.id, phase as JobPhase, id).catch(async (err) => {
      await db.job.update({ where: { id: job.id }, data: { status: "FAILED" } })
      await db.jobEvent.create({
        data: { jobId: job.id, type: "error", message: String(err) },
      })
    })
  }

  return NextResponse.json({ ok: true })
}
