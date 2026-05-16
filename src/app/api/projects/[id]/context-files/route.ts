import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { listS3Objects } from "@/lib/s3"

type Params = { id: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const files = await listS3Objects(project.s3Prefix)
    return NextResponse.json(
      files.map((f) => ({
        key: f.key,
        name: f.key.replace(`${project.s3Prefix}/`, ""),
        size: f.size,
        lastModified: f.lastModified,
      }))
    )
  } catch {
    // S3 not configured — return empty list so UI still works
    return NextResponse.json([])
  }
}
