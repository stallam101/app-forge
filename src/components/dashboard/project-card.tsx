import Link from "next/link"
import { Loader2, AlertCircle } from "lucide-react"
import type { ProjectSummary } from "@/types"
import { StatusBadge } from "./status-badge"

const PHASE_LABELS: Record<string, string> = {
  TICKET_CONTEXT_BUILD: "Ticket Creation",
  RESEARCH:             "Research",
  GENERATION:           "Generation",
  MAINTAIN_SEO:         "Maintain · SEO",
  MAINTAIN_AEO:         "Maintain · AEO",
  MAINTAIN_INCIDENT:    "Maintain · Incident",
}

function relativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface ProjectCardProps {
  project: ProjectSummary
  isDragging?: boolean
}

export function ProjectCard({ project, isDragging }: ProjectCardProps) {
  const { activeJob, status, messageCount, ideationComplete } = project
  const isBlocked = activeJob?.status === "BLOCKED"
  const isFailed = activeJob?.status === "FAILED"
  const isBuildingTicket =
    activeJob?.phase === "TICKET_CONTEXT_BUILD" &&
    (activeJob.status === "QUEUED" || activeJob.status === "RUNNING")
  const displayStatus = activeJob?.status ?? status

  const isNotStarted = status === "READY" && !activeJob && !ideationComplete && messageCount === 0
  const isIncomplete = status === "READY" && !activeJob && !ideationComplete && messageCount > 0

  const card = (
    <div
      className={[
        "bg-[#0a0a0a] border rounded-lg p-4 transition-colors duration-150 cursor-pointer select-none",
        isBlocked || isFailed ? "border-[#ef4444]" : "border-[#1a1a1a] hover:border-[#333]",
        isDragging ? "opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center justify-between mb-2">
        {isNotStarted ? (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#555]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#555] flex-none" />
            not started
          </span>
        ) : isIncomplete ? (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#f59e0b]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] flex-none" />
            incomplete
          </span>
        ) : (
          <StatusBadge status={displayStatus} />
        )}
        {activeJob && (
          <span className="text-[#555] text-[11px]">
            {PHASE_LABELS[activeJob.phase] ?? activeJob.phase}
          </span>
        )}
      </div>

      <p className="text-white text-[14px] font-medium leading-snug">{project.name}</p>

      {isBuildingTicket ? (
        <div className="flex items-center gap-2 mt-1">
          <Loader2 size={11} className="animate-spin text-[#555] flex-none" />
          <p className="text-[#888] text-[12px] line-clamp-1">
            {activeJob.lastMessage ?? "Building ticket..."}
          </p>
        </div>
      ) : isFailed ? (
        <div className="flex items-center gap-2 mt-1">
          <AlertCircle size={11} className="text-[#ef4444] flex-none" />
          <p className="text-[#ef4444] text-[12px] line-clamp-1">Build failed — click to retry</p>
        </div>
      ) : activeJob?.lastMessage ? (
        <p className="text-[#888] text-[12px] mt-1 line-clamp-1">{activeJob.lastMessage}</p>
      ) : (
        <p className="text-[#555] text-[12px] mt-1 line-clamp-1">{project.description}</p>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-[#555] text-[11px]">{relativeTime(project.updatedAt)}</span>
        {project.pendingApprovals ? (
          <span className="text-[#a855f7] text-[11px]">
            {project.pendingApprovals} approval{project.pendingApprovals > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>
    </div>
  )

  return (
    <Link href={`/projects/${project.id}`} className="block">
      {card}
    </Link>
  )
}
