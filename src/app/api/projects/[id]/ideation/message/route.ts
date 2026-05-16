import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { runAgent } from "@/lib/agent-runner"
import { writeContextFile, readContextFile } from "@/lib/context"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { message } = body

  const project = await db.project.findUnique({
    where: { id },
    include: {
      phaseJobs: {
        where: { phase: "IDEATION" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
  }

  // Get or create ideation job
  let job = project.phaseJobs[0]
  if (!job) {
    job = await db.phaseJob.create({
      data: {
        projectId: id,
        phase: "IDEATION",
        status: "RUNNING",
      },
    })

    // Move project to ideation if in backlog
    if (project.phase === "BACKLOG") {
      await db.project.update({
        where: { id },
        data: { phase: "IDEATION" },
      })
    }
  } else {
    await db.phaseJob.update({
      where: { id: job.id },
      data: { status: "RUNNING" },
    })
  }

  // Save user message (if provided — first turn has no user message)
  if (message) {
    await db.ideationMessage.create({
      data: {
        phaseJobId: job.id,
        projectId: id,
        role: "user",
        content: message,
      },
    })

    // Append to conversation.md
    const timestamp = new Date().toISOString()
    const turnBlock = `\n---\nrole: user\ndate: ${timestamp}\n---\n${message}\n`
    await appendConversation(id, turnBlock)
  }

  // Run ideation agent
  const result = await runAgent({
    projectId: id,
    phase: "IDEATION",
    message: message || undefined,
  })

  // Save agent response
  const agentMessage = await db.ideationMessage.create({
    data: {
      phaseJobId: job.id,
      projectId: id,
      role: "agent",
      content: result.output,
      filesWrittenJson: result.filesWritten.length > 0
        ? JSON.stringify(result.filesWritten)
        : null,
    },
  })

  // Append agent reply to conversation.md
  const agentTimestamp = new Date().toISOString()
  const agentTurnBlock = `\n---\nrole: agent\ndate: ${agentTimestamp}\nfiles_written:\n${result.filesWritten.map((f) => `  - ${f}`).join("\n")}\n---\n${result.output}\n`
  await appendConversation(id, agentTurnBlock)

  // Update job status
  await db.phaseJob.update({
    where: { id: job.id },
    data: { status: "AWAITING_MESSAGE" },
  })

  // Log
  await db.jobLog.create({
    data: {
      projectId: id,
      jobId: job.id,
      phase: "IDEATION",
      level: "INFO",
      message: `Turn complete. Agent replied (${result.output.length} chars).`,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      message: agentMessage,
      filesWritten: result.filesWritten,
    },
  })
}

async function appendConversation(projectId: string, block: string) {
  const existing = await readContextFile(projectId, "ideation/conversation.md")
  const content = (existing || "# Ideation Conversation\n") + block
  await writeContextFile(projectId, "ideation/conversation.md", content)
}
