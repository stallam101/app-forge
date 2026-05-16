import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import type { ProjectStatus, JobPhase } from "@/types"

const STATUS_TO_PHASE: Partial<Record<ProjectStatus, JobPhase>> = {
  RESEARCH: "RESEARCH",
  GENERATION: "GENERATION",
  MAINTAIN: "MAINTAIN_SEO",
}

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
    await db.job.create({
      data: { projectId: id, phase, status: "QUEUED" },
    })
  }

  return NextResponse.json({ ok: true })
}
