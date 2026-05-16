import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { runAgent } from "@/lib/agent-runner"

/**
 * Trigger maintain phase for a project.
 * For hackathon: manual trigger via button (not actual Vercel Cron).
 * Production: Vercel Cron hits this at 0 9 * * *
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { projectId } = body

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: "projectId required" },
      { status: 400 }
    )
  }

  const project = await db.project.findUnique({ where: { id: projectId } })

  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
  }

  if (project.phase !== "MAINTAIN") {
    return NextResponse.json(
      { success: false, error: "Project not in maintain phase" },
      { status: 400 }
    )
  }

  // Create maintain job
  const job = await db.phaseJob.create({
    data: {
      projectId,
      phase: "MAINTAIN",
      status: "RUNNING",
    },
  })

  await db.jobLog.create({
    data: {
      projectId,
      jobId: job.id,
      phase: "MAINTAIN",
      level: "INFO",
      message: "Maintain audit triggered.",
    },
  })

  // Run maintain agent (async — don't block response)
  runAgent({ projectId, phase: "MAINTAIN", trigger: "cron" }).then(async (result) => {
    await db.phaseJob.update({
      where: { id: job.id },
      data: {
        status: result.success ? "COMPLETE" : "FAILED",
        completedAt: new Date(),
      },
    })

    await db.jobLog.create({
      data: {
        projectId,
        jobId: job.id,
        phase: "MAINTAIN",
        level: result.success ? "COMPLETE" : "ERROR",
        message: result.success
          ? `Maintain audit complete. ${result.filesWritten.length} files written.`
          : `Maintain failed: ${result.error}`,
      },
    })
  })

  return NextResponse.json({ success: true, data: { jobId: job.id } })
}
