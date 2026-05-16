"use client"

import { useCallback, useEffect, useState } from "react"
import { DndContext, DragEndEvent, DragOverlay, closestCenter } from "@dnd-kit/core"
import type { ProjectSummary, ProjectStatus } from "@/types"
import { KanbanColumn } from "./kanban-column"
import { ProjectCard } from "./project-card"
import { ReadyShelf } from "./ready-shelf"

const COLUMNS: { id: ProjectStatus; label: string }[] = [
  { id: "RESEARCH",   label: "Research" },
  { id: "GENERATION", label: "Generation" },
  { id: "MAINTAIN",   label: "Maintain" },
  { id: "ARCHIVED",   label: "Archived" },
]

const ACTIVE_JOB_STATUSES = ["RUNNING", "QUEUED"] as const

interface KanbanBoardProps {
  initialProjects: ProjectSummary[]
}

export function KanbanBoard({ initialProjects }: KanbanBoardProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch("/api/projects")
    if (!res.ok) return
    const data = await res.json()
    setProjects(
      data.map(
        (
          p: ProjectSummary & {
            createdAt: string
            updatedAt: string
            activeJob?: ProjectSummary["activeJob"] & { updatedAt: string }
          }
        ) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
          activeJob: p.activeJob
            ? { ...p.activeJob, updatedAt: new Date(p.activeJob.updatedAt) }
            : undefined,
        })
      )
    )
  }, [])

  // Hot poll (2s) only while something is running or queued; slow poll (10s) otherwise.
  useEffect(() => {
    const anyActive = projects.some(
      (p) =>
        p.activeJob &&
        (ACTIVE_JOB_STATUSES as readonly string[]).includes(p.activeJob.status)
    )
    const intervalMs = anyActive ? 2000 : 10000
    const interval = setInterval(refresh, intervalMs)
    return () => clearInterval(interval)
  }, [projects, refresh])

  const readyProjects = projects.filter((p) => p.status === "READY")
  const byStatus = (status: ProjectStatus) => projects.filter((p) => p.status === status)
  const draggingProject = projects.find((p) => p.id === draggingId)

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDraggingId(null)

    if (!over) return
    const projectId = active.id as string
    const targetStatus = over.id as ProjectStatus

    if (targetStatus === "RESEARCH") {
      await fetch(`/api/projects/${projectId}/phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESEARCH" }),
      })
      void refresh()
    }
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={(e) => setDraggingId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <ReadyShelf projects={readyProjects} />

      <div className="flex gap-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            projects={byStatus(col.id)}
          />
        ))}
      </div>

      <DragOverlay>
        {draggingProject ? (
          <div className="w-[280px]">
            <ProjectCard project={draggingProject} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
