import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { getS3Object } from "@/lib/s3"

type Params = { id: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const key = req.nextUrl.searchParams.get("key")
  if (!key || key.includes("..") || key.startsWith("/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 })
  }

  try {
    const content = await getS3Object(`${project.s3Prefix}/${key}`)
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ content: null })
  }
}
