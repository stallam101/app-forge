import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const project = await db.project.findUnique({
    where: { id },
    include: {
      phaseJobs: {
        where: { phase: "IDEATION", status: "AWAITING_MESSAGE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
  }

  const job = project.phaseJobs[0]
  if (!job) {
    return NextResponse.json(
      { success: false, error: "No active ideation job" },
      { status: 400 }
    )
  }

  // Mark ideation as awaiting approval (user must approve to move to generation)
  await db.phaseJob.update({
    where: { id: job.id },
    data: { status: "AWAITING_APPROVAL" },
  })

  // Log
  await db.jobLog.create({
    data: {
      projectId: id,
      jobId: job.id,
      phase: "IDEATION",
      level: "COMPLETE",
      message: "Ideation finalized. Awaiting user approval to proceed to Generation.",
    },
  })

  return NextResponse.json({
    success: true,
    data: { status: "AWAITING_APPROVAL" },
  })
}
