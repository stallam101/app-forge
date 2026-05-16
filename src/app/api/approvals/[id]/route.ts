import { NextRequest, NextResponse } from "next/server"
<<<<<<< HEAD
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

type Params = { id: string }

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { status } = await req.json() as { status: "APPROVED" | "REJECTED" }

  const approval = await db.approval.update({
    where: { id },
    data: {
      status,
      resolvedAt: new Date(),
    },
  })

  return NextResponse.json(approval)
=======
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
>>>>>>> 66dcf6bb2c6f4ac90238724d397c0d78437ec439
}
