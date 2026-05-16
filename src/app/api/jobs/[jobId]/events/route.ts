import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { ProjectStatus } from "@/types"

type Params = { jobId: string }

const TERMINAL_STATUSES = ["COMPLETE", "FAILED"] as const

// What status/phase does each phase transition to on completion?
const PHASE_TRANSITIONS: Partial<Record<string, { targetStatus: ProjectStatus; label: string }>> = {
  RESEARCH:          { targetStatus: "GENERATION", label: "Move to Generation" },
  GENERATION:        { targetStatus: "MAINTAIN",   label: "Move to Maintain" },
  MAINTAIN_SEO:      { targetStatus: "MAINTAIN",   label: "Approve SEO changes" },
  MAINTAIN_AEO:      { targetStatus: "MAINTAIN",   label: "Approve AEO changes" },
  MAINTAIN_INCIDENT: { targetStatus: "MAINTAIN",   label: "Approve incident fix" },
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { jobId } = await params
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")

  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job || job.jobToken !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type, message, metadata } = await req.json()

  await db.jobEvent.create({
    data: { jobId, type, message, metadata: metadata ?? undefined },
  })

  // Map event type to job status
  let newStatus: string | undefined
  if (type === "complete") {
    newStatus = job.phase === "TICKET_CONTEXT_BUILD" ? "COMPLETE" : "AWAITING_APPROVAL"
  } else if (type === "error") {
    newStatus = "FAILED"
  } else if (type === "blocker" || type === "approval_request") {
    newStatus = "AWAITING_APPROVAL"
  }

  if (newStatus) {
    // Guard: don't override a job already in a terminal state
    const updated = await db.job.updateMany({
      where: { id: jobId, status: { notIn: [...TERMINAL_STATUSES] } },
      data: { status: newStatus as "COMPLETE" | "FAILED" | "BLOCKED" | "AWAITING_APPROVAL" },
    })

    // When a non-ticket phase completes, create a PHASE_TRANSITION approval.
    if (type === "complete" && updated.count > 0) {
      const transition = PHASE_TRANSITIONS[job.phase]
      if (transition) {
        const existing = await db.approval.findFirst({
          where: { jobId, type: "PHASE_TRANSITION", status: "PENDING" },
        })
        if (!existing) {
          await db.approval.create({
            data: {
              projectId: job.projectId,
              jobId,
              type: "PHASE_TRANSITION",
              title: transition.label,
              description: `${job.phase} phase is complete. Approve to continue to the next step.`,
              metadata: { targetStatus: transition.targetStatus },
            },
          })
        }
      }
    }

    // When the agent sends an approval_request mid-job, create the approval row
    // so it surfaces in the Approvals tab (without this the job sits AWAITING_APPROVAL invisibly).
    if (type === "approval_request" && updated.count > 0) {
      const meta = metadata as { type?: string; targetStatus?: string } | null
      const approvalType = (meta?.type ?? "PHASE_TRANSITION") as import("@/types").ApprovalType
      const existing = await db.approval.findFirst({
        where: { jobId, type: approvalType, status: "PENDING" },
      })
      if (!existing) {
        const transition = PHASE_TRANSITIONS[job.phase]
        await db.approval.create({
          data: {
            projectId: job.projectId,
            jobId,
            type: approvalType,
            title: message ?? transition?.label ?? "Approval required",
            description: message ?? "The agent requires your approval to continue.",
            metadata: meta?.targetStatus
              ? { targetStatus: meta.targetStatus }
              : transition
              ? { targetStatus: transition.targetStatus }
              : undefined,
          },
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
