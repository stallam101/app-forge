import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { TicketBuildingView } from "./ticket-building-view"
import { TicketFailedView } from "./ticket-failed-view"
import { IdeationView } from "./ideation-view"

type Params = { id: string }

export default async function ProjectDetailPage({ params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const { id } = await params

  const project = await db.project.findUnique({
    where: { id },
    include: {
      jobs: {
        where: { phase: "TICKET_CONTEXT_BUILD" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { events: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
      messages: {
        orderBy: { turn: "asc" },
      },
    },
  })

  if (!project) notFound()

  const job = project.jobs[0]
  const isBuildingTicket = job && (job.status === "QUEUED" || job.status === "RUNNING")
  const isFailed = job?.status === "FAILED"
  const ideationComplete = job?.status === "COMPLETE"

  if (isBuildingTicket) {
    return <TicketBuildingView jobId={job.id} projectName={project.name} />
  }

  if (isFailed) {
    const lastError = job.events[0]?.message
    return (
      <TicketFailedView
        projectId={id}
        projectName={project.name}
        errorMessage={lastError}
      />
    )
  }

  const initialMessages = project.messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
  }))

  return (
    <IdeationView
      projectId={id}
      projectName={project.name}
      initialMessages={initialMessages}
      briefExists={ideationComplete}
    />
  )
}
