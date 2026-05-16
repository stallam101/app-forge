import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const messages = await db.ideationMessage.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
  })

  const data = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    citations: m.citationsJson ? JSON.parse(m.citationsJson) : undefined,
    filesWritten: m.filesWrittenJson ? JSON.parse(m.filesWrittenJson) : undefined,
    createdAt: m.createdAt.toISOString(),
  }))

  return NextResponse.json({ success: true, data })
}
