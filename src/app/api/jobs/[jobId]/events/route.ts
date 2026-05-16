import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { jobId: string }

const TERMINAL_STATUSES = ["COMPLETE", "FAILED"] as const

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
    // TICKET_CONTEXT_BUILD needs no user approval — mark COMPLETE so the brief view shows
    // All other phases wait for user to approve before moving forward
    newStatus = job.phase === "TICKET_CONTEXT_BUILD" ? "COMPLETE" : "AWAITING_APPROVAL"
  } else if (type === "error") {
    newStatus = "FAILED"
  } else if (type === "blocker" || type === "approval_request") {
    newStatus = "AWAITING_APPROVAL"
  }

  if (newStatus) {
    // Guard: don't override a job already in a terminal state
    await db.job.updateMany({
      where: { id: jobId, status: { notIn: [...TERMINAL_STATUSES] } },
      data: { status: newStatus as "COMPLETE" | "FAILED" | "BLOCKED" | "AWAITING_APPROVAL" },
    })
  }

  return NextResponse.json({ ok: true })
}
