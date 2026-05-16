"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, MessageSquare } from "lucide-react"
import type { ProjectCard, Phase } from "@/types"
import { PHASE_ORDER, STATUS_LABELS } from "@/types"
import { cn } from "@/lib/utils"

interface KanbanCardProps {
  project: ProjectCard
  onMove: (projectId: string, newPhase: Phase) => void
}

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-muted text-muted-foreground",
  RUNNING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  AWAITING_MESSAGE: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  AWAITING_APPROVAL: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  BLOCKED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  COMPLETE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
}

export function KanbanCard({ project, onMove }: KanbanCardProps) {
  const currentIndex = PHASE_ORDER.indexOf(project.phase)
  const nextPhase = PHASE_ORDER[currentIndex + 1] as Phase | undefined

  const isIdeation = project.phase === "IDEATION"
  const canAdvance = nextPhase && project.status === "AWAITING_APPROVAL"

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between">
        <h3 className="text-sm font-medium leading-tight">{project.name}</h3>
        {project.status && (
          <Badge
            variant="secondary"
            className={cn("ml-2 shrink-0 text-[10px]", STATUS_COLORS[project.status])}
          >
            {STATUS_LABELS[project.status]}
          </Badge>
        )}
      </div>

      <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
        {project.description}
      </p>

      <div className="flex items-center gap-1.5">
        {isIdeation && (
          <Link href={`/projects/${project.id}/chat`}>
            <Button variant="outline" size="xs">
              <MessageSquare className="size-3" data-icon="inline-start" />
              Chat
            </Button>
          </Link>
        )}

        {canAdvance && nextPhase && (
          <Button
            variant="default"
            size="xs"
            onClick={() => onMove(project.id, nextPhase)}
          >
            Approve
            <ArrowRight className="size-3" data-icon="inline-end" />
          </Button>
        )}

        {project.phase === "BACKLOG" && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => onMove(project.id, "IDEATION")}
          >
            Start Ideation
            <ArrowRight className="size-3" data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  )
}
