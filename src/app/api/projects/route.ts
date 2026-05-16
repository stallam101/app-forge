import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { seedProjectContext } from "@/lib/context"

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      phaseJobs: {
        where: { status: { not: "COMPLETE" } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  const cards = projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    phase: p.phase,
    status: p.phaseJobs[0]?.status ?? null,
    createdAt: p.createdAt.toISOString(),
  }))

  return NextResponse.json({ success: true, data: cards })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, description } = body

  if (!name || !description) {
    return NextResponse.json(
      { success: false, error: "Name and description are required" },
      { status: 400 }
    )
  }

  const project = await db.project.create({
    data: { name, description },
  })

  await seedProjectContext(project.id, name, description)

  return NextResponse.json({ success: true, data: project }, { status: 201 })
}
