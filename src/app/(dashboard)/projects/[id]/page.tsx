import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { getS3Object } from "@/lib/s3"
import { TicketBuildingView } from "./ticket-building-view"
import { TicketFailedView } from "./ticket-failed-view"
import { IdeationView } from "./ideation-view"
import { ProjectBriefView } from "./project-brief-view"
import { ResearchView } from "./research-view"
import { GenerationView } from "./generation-view"
import { MaintainView } from "./maintain-view"
import type { JobStatus } from "@/types"

type Params = { id: string }

const RESEARCH_ARTIFACT_KEYS = ["research.md"]

export default async function ProjectDetailPage({ params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const { id } = await params

  const project = await db.project.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { turn: "asc" } },
    },
  })

  if (!project) notFound()

  if (project.status === "RESEARCH") {
    return renderResearch(project)
  }

  if (project.status === "GENERATION") {
    return <GenerationView projectName={project.name} />
  }

  if (project.status === "MAINTAIN") {
    return renderMaintain(project.id, project.name)
  }

  if (project.status === "ARCHIVED") {
    // Treat archived like a read-only brief view for now
    return renderReadyBranch(project)
  }

  // READY (default)
  return renderReadyBranch(project)
}

type ProjectWithMessages = Awaited<ReturnType<typeof db.project.findUnique>> & {
  messages: { id: string; role: string; content: string; turn: number }[]
}

async function renderReadyBranch(project: ProjectWithMessages) {
  const ticketBuildJob = await db.job.findFirst({
    where: { projectId: project.id, phase: "TICKET_CONTEXT_BUILD" },
    orderBy: { createdAt: "desc" },
    include: { events: { orderBy: { createdAt: "desc" }, take: 1 } },
  })

  const isBuilding = ticketBuildJob &&
    (ticketBuildJob.status === "QUEUED" || ticketBuildJob.status === "RUNNING")
  const isFailed = ticketBuildJob?.status === "FAILED"
  const isComplete = ticketBuildJob?.status === "COMPLETE"

  if (isBuilding) {
    return <TicketBuildingView jobId={ticketBuildJob.id} projectName={project.name} />
  }

  if (isFailed) {
    const lastError = ticketBuildJob.events[0]?.message
    return (
      <TicketFailedView
        projectId={project.id}
        projectName={project.name}
        errorMessage={lastError}
      />
    )
  }

  if (isComplete) {
    const brief = (await getS3Object(`${project.s3Prefix}/brief.md`)) ?? ""
    const initialMessages = project.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    }))
    return (
      <ProjectBriefView
        projectId={project.id}
        projectName={project.name}
        brief={brief}
        initialMessages={initialMessages}
      />
    )
  }

  // Default: chat ideation
  const initialMessages = project.messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
  }))
  return (
    <IdeationView
      projectId={project.id}
      projectName={project.name}
      initialMessages={initialMessages}
      briefExists={false}
    />
  )
}

async function renderResearch(project: ProjectWithMessages) {
  const job = await db.job.findFirst({
    where: { projectId: project.id, phase: "RESEARCH" },
    orderBy: { createdAt: "desc" },
    include: { events: { orderBy: { createdAt: "asc" }, take: 200 } },
  })

  const initialEvents = (job?.events ?? []).map((e) => ({
    type: e.type,
    message: e.message,
    metadata: (e.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: e.createdAt.toISOString(),
  }))

  const artifactEntries = await Promise.all(
    RESEARCH_ARTIFACT_KEYS.map(async (key) => ({
      name: key,
      content: await getS3Object(`${project.s3Prefix}/${key}`),
    }))
  )

  return (
    <ResearchView
      projectId={project.id}
      projectName={project.name}
      jobId={job?.id ?? null}
      initialJobStatus={(job?.status as JobStatus | undefined) ?? null}
      initialEvents={initialEvents}
      initialArtifacts={artifactEntries}
    />
  )
}

async function renderMaintain(projectId: string, projectName: string) {
  const [latestJob, pendingApprovals] = await Promise.all([
    db.job.findFirst({
      where: {
        projectId,
        phase: { in: ["MAINTAIN_SEO", "MAINTAIN_AEO", "MAINTAIN_INCIDENT"] },
      },
      orderBy: { createdAt: "desc" },
      include: { events: { orderBy: { createdAt: "desc" }, take: 20 } },
    }),
    db.approval.findMany({
      where: { projectId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ])

  const recentActivity = (latestJob?.events ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    message: e.message,
    createdAt: e.createdAt.toISOString(),
  }))

  const approvals = pendingApprovals.map((a) => ({
    id: a.id,
    type: a.type as string,
    summary: a.title,
    createdAt: a.createdAt.toISOString(),
  }))

  return (
    <MaintainView
      projectName={projectName}
      recentActivity={recentActivity}
      pendingApprovals={approvals}
    />
  )
}
