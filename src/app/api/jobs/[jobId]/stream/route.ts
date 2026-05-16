import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { isECSTaskStopped } from "@/lib/ecs"

type Params = { jobId: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { jobId } = await params
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) return new Response("Not found", { status: 404 })

  let lastEventId: string | null = null

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      async function poll() {
        if (req.signal.aborted) {
          controller.close()
          return
        }

        // Re-fetch job status — handle terminal states the container never reported
        const currentJob = await db.job.findUnique({ where: { id: jobId } })
        if (currentJob?.status === "FAILED") {
          const lastEvent = await db.jobEvent.findFirst({ where: { jobId }, orderBy: { createdAt: "desc" } })
          send({ type: "error", message: lastEvent?.message ?? "Project creation failed" })
          controller.close()
          return
        }
        if (currentJob?.status === "COMPLETE") {
          send({ type: "complete", message: "Done" })
          controller.close()
          return
        }

        // Detect crashed container: task stopped but job never posted a terminal event
        if (currentJob?.status === "RUNNING" && currentJob.ecsTaskArn) {
          const stopped = await isECSTaskStopped(currentJob.ecsTaskArn)
          if (stopped) {
            await db.job.update({ where: { id: jobId }, data: { status: "FAILED" } })
            await db.jobEvent.create({
              data: { jobId, type: "error", message: "Project creation failed — container exited unexpectedly" },
            })
            send({ type: "error", message: "Project creation failed — container exited unexpectedly" })
            controller.close()
            return
          }
        }

        const events = await db.jobEvent.findMany({
          where: { jobId, ...(lastEventId ? { id: { gt: lastEventId } } : {}) },
          orderBy: { createdAt: "asc" },
        })

        for (const event of events) {
          lastEventId = event.id
          send({ type: event.type, message: event.message, metadata: event.metadata, createdAt: event.createdAt })

          if (event.type === "complete" || event.type === "error") {
            controller.close()
            return
          }
        }

        await new Promise((r) => setTimeout(r, 1500))
        poll()
      }

      poll()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
