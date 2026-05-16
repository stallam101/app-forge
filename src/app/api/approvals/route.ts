<<<<<<< HEAD
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import type { ApprovalType } from "@/types"

// Agent creates approval requests — authenticated by job token
export async function POST(req: NextRequest) {
  const { projectId, jobId, title, description, type, metadata } = await req.json()

  // Validate job token
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")
  if (jobId) {
    const job = await db.job.findUnique({ where: { id: jobId } })
    if (!job || job.jobToken !== token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const approval = await db.approval.create({
    data: {
      projectId,
      jobId: jobId ?? null,
      title,
      description,
      type: type as ApprovalType,
      metadata: metadata ?? undefined,
    },
  })

  return NextResponse.json({ id: approval.id }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? "PENDING"

  const approvals = await db.approval.findMany({
    where: { status: status as "PENDING" | "APPROVED" | "REJECTED" },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { name: true } } },
  })

  return NextResponse.json(approvals)
=======
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  const approvals = await db.approvalRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ success: true, data: approvals })
>>>>>>> 66dcf6bb2c6f4ac90238724d397c0d78437ec439
}
