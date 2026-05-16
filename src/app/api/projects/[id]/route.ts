import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const project = await db.project.findUnique({
    where: { id },
    include: {
      phaseJobs: { orderBy: { createdAt: "desc" } },
      approvalRequests: { where: { status: "PENDING" } },
    },
  })

  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: project })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  const project = await db.project.update({
    where: { id },
    data: body,
  })

  return NextResponse.json({ success: true, data: project })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  await db.project.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
