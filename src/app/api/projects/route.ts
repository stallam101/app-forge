import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { putS3Object } from "@/lib/s3"
import type { ProjectSummary, JobPhase, JobStatus } from "@/types"

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let name = "Untitled"
  let description = ""
  try {
    const body = await req.json()
    if (typeof body.name === "string" && body.name.trim()) name = body.name.trim()
    if (typeof body.description === "string") description = body.description.trim()
  } catch { /* no body is fine */ }

  // Create first, then derive s3Prefix from the generated ID
  const project = await db.project.create({
    data: { name, description, status: "READY", s3Prefix: "" },
  })
  const s3Prefix = `projects/${project.id}`
  await db.project.update({ where: { id: project.id }, data: { s3Prefix } })

  // Seed S3 context stubs — fire and forget, don't block response
  const stubs = [
    { key: `${s3Prefix}/brief.md`, body: "# Brief\n\n_To be filled during ticket creation._\n" },
    { key: `${s3Prefix}/platform-constraints.md`, body: "# Platform Constraints\n\n_Hosting: Vercel. Runtime: Node.js._\n" },
    { key: `${s3Prefix}/project-context.md`, body: "# Project Context\n\n_Updated after each agent phase._\n" },
    { key: `${s3Prefix}/index.md`, body: "# Context Index\n\n_Source of truth for all context files._\n" },
    { key: `${s3Prefix}/log.md`, body: "# Activity Log\n\n_Appended by each agent phase._\n" },
  ]
  void Promise.all(stubs.map(({ key, body }) => putS3Object(key, body))).catch(() => {})

  return NextResponse.json({ id: project.id, s3Prefix: project.s3Prefix }, { status: 201 })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ACTIVE_STATUSES = ["QUEUED", "RUNNING", "BLOCKED", "AWAITING_APPROVAL", "FAILED"] as const

  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      jobs: {
        where: {
          OR: [
            { status: { in: [...ACTIVE_STATUSES] } },
            { status: "COMPLETE" },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: { events: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
      _count: { select: { approvals: { where: { status: "PENDING" } }, messages: true } },
    },
  })

  const summaries: ProjectSummary[] = projects.map((p) => {
    const activeJob = p.jobs.find((j) => (ACTIVE_STATUSES as readonly string[]).includes(j.status))
    // If no in-flight job, surface the most recent COMPLETE job so the UI knows the phase finished
    const displayJob = activeJob ?? p.jobs.find((j) => j.status === "COMPLETE")
    const ideationComplete = p.jobs.some(
      (j) => j.phase === "TICKET_CONTEXT_BUILD" && j.status === "COMPLETE"
    )
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status as ProjectSummary["status"],
      s3Prefix: p.s3Prefix,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      activeJob: displayJob
        ? {
            id: displayJob.id,
            phase: displayJob.phase as JobPhase,
            status: displayJob.status as JobStatus,
            updatedAt: displayJob.updatedAt,
            lastMessage: displayJob.events[0]?.message,
          }
        : undefined,
      messageCount: p._count.messages ?? 0,
      ideationComplete,
      pendingApprovals: p._count.approvals || undefined,
    }
  })

  return NextResponse.json(summaries)
}
