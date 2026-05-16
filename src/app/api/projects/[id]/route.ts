import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const allowed = ["name", "description"] as const
  const data: Record<string, string> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key]
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const project = await db.project.update({
    where: { id },
    data,
  })

  return NextResponse.json({ success: true, data: project })
}
