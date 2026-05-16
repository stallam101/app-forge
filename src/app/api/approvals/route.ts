import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  const approvals = await db.approvalRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ success: true, data: approvals })
}
