<<<<<<< HEAD
import { db } from "@/lib/db"
import { KanbanBoard } from "@/components/dashboard/kanban-board"
import type { ProjectSummary, JobPhase, JobStatus } from "@/types"

const ACTIVE_STATUSES = ["QUEUED", "RUNNING", "BLOCKED", "AWAITING_APPROVAL", "FAILED"] as const

export default async function DashboardPage() {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      jobs: {
        where: {
          OR: [
            { status: { in: [...ACTIVE_STATUSES] } },
            { phase: "TICKET_CONTEXT_BUILD", status: "COMPLETE" },
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
      activeJob: activeJob
        ? {
            id: activeJob.id,
            phase: activeJob.phase as JobPhase,
            status: activeJob.status as JobStatus,
            updatedAt: activeJob.updatedAt,
            lastMessage: activeJob.events[0]?.message,
          }
        : undefined,
      messageCount: p._count.messages,
      ideationComplete,
      pendingApprovals: p._count.approvals || undefined,
    }
  })

  return <KanbanBoard initialProjects={summaries} />
=======
import { KanbanBoard } from "@/components/kanban/board"

export default function DashboardPage() {
  return <KanbanBoard />
>>>>>>> 66dcf6bb2c6f4ac90238724d397c0d78437ec439
}
