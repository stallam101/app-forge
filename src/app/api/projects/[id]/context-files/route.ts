import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { listS3Objects, getS3Object } from "@/lib/s3"

type Params = { id: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // ?file=filename.md → return file content
  const fileName = req.nextUrl.searchParams.get("file")
  if (fileName) {
    try {
      const content = await getS3Object(`${project.s3Prefix}/${fileName}`)
      if (content === null) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ content })
    } catch {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 })
    }
  }

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
    return NextResponse.json([])
  }
}
