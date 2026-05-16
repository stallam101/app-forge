import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { Phase } from "@/types"

const NEXT_PHASE: Record<string, Phase> = {
  IDEATION: "GENERATION",
  GENERATION: "MAINTAIN",
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const project = await db.project.findUnique({
    where: { id },
    include: {
      phaseJobs: {
        where: { status: "AWAITING_APPROVAL" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
  }

  const currentJob = project.phaseJobs[0]
  if (!currentJob) {
    return NextResponse.json(
      { success: false, error: "No job awaiting approval" },
      { status: 400 }
    )
  }

  const nextPhase = NEXT_PHASE[project.phase]
  if (!nextPhase) {
    return NextResponse.json(
      { success: false, error: `No next phase after ${project.phase}` },
      { status: 400 }
    )
  }

  // Complete current job
  await db.phaseJob.update({
    where: { id: currentJob.id },
    data: { status: "COMPLETE", completedAt: new Date() },
  })

  // Move project to next phase
  const updated = await db.project.update({
    where: { id },
    data: { phase: nextPhase },
  })

  // Create new phase job
  const newJob = await db.phaseJob.create({
    data: {
      projectId: id,
      phase: nextPhase,
      status: "QUEUED",
    },
  })

  return NextResponse.json({
    success: true,
    data: { project: updated, newJob },
  })
}
