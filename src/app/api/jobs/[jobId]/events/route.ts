import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = { jobId: string }

const STATUS_MAP: Record<string, "RUNNING" | "COMPLETE" | "FAILED" | "BLOCKED" | "AWAITING_APPROVAL"> = {
  complete: "COMPLETE",
  error: "FAILED",
  blocker: "BLOCKED",
  approval_request: "AWAITING_APPROVAL",
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

  const newStatus = STATUS_MAP[type]
  if (newStatus) {
    await db.job.update({ where: { id: jobId }, data: { status: newStatus } })
  }

  return NextResponse.json({ ok: true })
}
