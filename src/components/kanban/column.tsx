"use client"

import { KanbanCard } from "./card"
import type { ProjectCard, Phase } from "@/types"

interface KanbanColumnProps {
  phase: Phase
  label: string
  projects: ProjectCard[]
  onMoveProject: (projectId: string, newPhase: Phase) => void
}

export function KanbanColumn({ phase, label, projects, onMoveProject }: KanbanColumnProps) {
  return (
    <div className="flex w-72 min-w-72 flex-col rounded-lg bg-muted/50">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {projects.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {projects.map((project) => (
          <KanbanCard
            key={project.id}
            project={project}
            onMove={onMoveProject}
          />
        ))}
        {projects.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
            No projects
          </div>
        )}
      </div>
    </div>
  )
}
