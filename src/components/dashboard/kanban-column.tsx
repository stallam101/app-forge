"use client"

import { useDroppable } from "@dnd-kit/core"
import type { ProjectSummary, ProjectStatus } from "@/types"
import { ProjectCard } from "./project-card"

interface KanbanColumnProps {
  id: ProjectStatus
  label: string
  projects: ProjectSummary[]
}

export function KanbanColumn({ id, label, projects }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#888] text-xs uppercase tracking-widest">{label}</span>
        {projects.length > 0 && (
          <span className="text-[#555] text-[11px]">{projects.length}</span>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={[
          "flex flex-col gap-2 min-h-[120px] rounded-lg transition-colors duration-150 p-1 -m-1",
          isOver ? "bg-[#0a0a0a]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  )
}
