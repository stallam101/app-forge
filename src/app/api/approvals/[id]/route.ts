import { NextRequest, NextResponse } from "next/server"
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
}
