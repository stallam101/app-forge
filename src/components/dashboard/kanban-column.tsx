"use client"

import { useDroppable } from "@dnd-kit/core"
import type { ProjectSummary, ProjectStatus } from "@/types"
import { ProjectCard } from "./project-card"

interface KanbanColumnProps {
  id: ProjectStatus
  label: string
  projects: ProjectSummary[]
  isValidTarget?: boolean
  isDragging?: boolean
  onStatusChange?: (projectId: string, newStatus: string) => void
}

export function KanbanColumn({ id, label, projects, isValidTarget, isDragging, onStatusChange }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id })

  const showAccept = isDragging && isValidTarget && isOver
  const showHint = isDragging && isValidTarget && !isOver
  const showReject = isDragging && !isValidTarget

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <span className={[
          "text-xs uppercase tracking-widest transition-colors duration-150",
          showAccept ? "text-green-400" : showHint ? "text-[#aaa]" : "text-[#888]",
        ].join(" ")}>{label}</span>
        {projects.length > 0 && (
          <span className="text-[#555] text-[11px]">{projects.length}</span>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={[
          "flex flex-col gap-2 min-h-[120px] rounded-lg transition-all duration-150 p-1 -m-1",
          showAccept ? "bg-green-500/10 ring-1 ring-green-500/30" : "",
          showHint ? "bg-[#0d0d0d] ring-1 ring-[#333]" : "",
          showReject ? "opacity-40" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} onStatusChange={onStatusChange} />
        ))}
      </div>
    </div>
  )
}
