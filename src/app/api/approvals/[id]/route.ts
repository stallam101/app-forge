import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { status } = body

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json(
      { success: false, error: "Invalid status" },
      { status: 400 }
    )
  }

  const approval = await db.approvalRequest.update({
    where: { id },
    data: { status, resolvedAt: new Date() },
  })

  return NextResponse.json({ success: true, data: approval })
}
