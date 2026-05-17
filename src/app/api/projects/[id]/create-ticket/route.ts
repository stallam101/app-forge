import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { putS3Object } from "@/lib/s3"
import { launchECSTask } from "@/lib/ecs"

type Params = { id: string }

export async function POST(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Serialize conversation transcript into brief.md for the context-build agent
  const messages = await db.message.findMany({
    where: { projectId: id },
    orderBy: { turn: "asc" },
  })

  const transcript = messages
    .map((m) => `**${m.role === "user" ? "User" : "Agent"}:** ${m.content}`)
    .join("\n\n")

  await putS3Object(
    `${project.s3Prefix}/brief.md`,
    `# Ideation Conversation\n\n${transcript}\n`
  )

  const job = await db.job.create({
    data: { projectId: id, phase: "TICKET_CONTEXT_BUILD", status: "QUEUED" },
  })

  // Launch immediately — no cron needed
  void launchECSTask(job.id, "TICKET_CONTEXT_BUILD", id).catch(async (err) => {
    await db.job.update({ where: { id: job.id }, data: { status: "FAILED" } })
    await db.jobEvent.create({
      data: { jobId: job.id, type: "error", message: String(err) },
    })
  })

  return NextResponse.json({ jobId: job.id }, { status: 201 })
}
