import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSSEResponse } from "@/lib/sse"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  return createSSEResponse(async (send, close) => {
    // Send initial project state
    const project = await db.project.findUnique({
      where: { id },
      include: {
        phaseJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    })

    if (!project) {
      send({ type: "error", data: { message: "Project not found" } })
      close()
      return
    }

    send({
      type: "status",
      data: {
        phase: project.phase,
        status: project.phaseJobs[0]?.status ?? null,
      },
    })

    // Poll for new logs every 2 seconds
    let lastLogId: string | null = null
    const interval = setInterval(async () => {
      try {
        const logs = await db.jobLog.findMany({
          where: {
            projectId: id,
            ...(lastLogId ? { id: { gt: lastLogId } } : {}),
          },
          orderBy: { createdAt: "asc" },
          take: 20,
        })

        for (const log of logs) {
          send({
            type: "log",
            data: {
              id: log.id,
              level: log.level,
              message: log.message,
              createdAt: log.createdAt.toISOString(),
            },
          })
          lastLogId = log.id
        }

        // Check for status changes
        const currentJob = await db.phaseJob.findFirst({
          where: { projectId: id },
          orderBy: { createdAt: "desc" },
        })

        if (currentJob) {
          send({
            type: "status",
            data: { phase: currentJob.phase, status: currentJob.status },
          })

          if (currentJob.status === "COMPLETE" || currentJob.status === "FAILED") {
            send({ type: "complete", data: { status: currentJob.status } })
            clearInterval(interval)
            close()
          }
        }
      } catch {
        // Connection closed
        clearInterval(interval)
      }
    }, 2000)

    // Keep alive for up to 5 minutes
    setTimeout(() => {
      clearInterval(interval)
      close()
    }, 300000)
  })
}
