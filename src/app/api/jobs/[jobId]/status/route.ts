import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

type Params = { jobId: string }

export async function GET(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId } = await params
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    id: job.id,
    phase: job.phase,
    status: job.status,
    lastMessage: job.events[0]?.message ?? null,
    updatedAt: job.updatedAt,
  })
}
