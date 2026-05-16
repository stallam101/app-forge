"use client"

import { useCallback, useEffect, useState } from "react"
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core"
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

/** Valid transitions: source status → allowed target statuses (drag only) */
const VALID_TRANSITIONS: Partial<Record<ProjectStatus, ProjectStatus[]>> = {
  READY:      ["RESEARCH"],
  RESEARCH:   ["GENERATION"],
  GENERATION: ["MAINTAIN"],
}

const ACTIVE_JOB_STATUSES = ["RUNNING", "QUEUED"] as const

interface KanbanBoardProps {
  initialProjects: ProjectSummary[]
}

export function KanbanBoard({ initialProjects }: KanbanBoardProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Require 8px of movement before a drag activates — below this threshold, clicks go through normally
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

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

  function handleStatusChange(projectId: string, newStatus: string) {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status: newStatus as ProjectStatus } : p))
    )
  }

  /** Check if a project can be dragged at all (must have completed its current phase) */
  function canDrag(project: ProjectSummary): boolean {
    if (project.status === "READY") return project.ideationComplete
    if (project.status === "RESEARCH") return project.activeJob?.status === "COMPLETE"
    if (project.status === "GENERATION") return project.activeJob?.status === "COMPLETE"
    return false
  }

  /** Check if a project can be dropped on a specific target column */
  function canDrop(project: ProjectSummary, targetStatus: ProjectStatus): boolean {
    if (project.status === targetStatus) return false
    const allowed = VALID_TRANSITIONS[project.status]
    if (!allowed || !allowed.includes(targetStatus)) return false
    // Must have completed current phase to transition
    return canDrag(project)
  }

  // Compute which columns are valid drop targets for the currently dragged project
  const validDropTargets = draggingProject
    ? COLUMNS.filter((col) => canDrop(draggingProject, col.id)).map((c) => c.id)
    : []

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDraggingId(null)

    if (!over) return
    const projectId = active.id as string
    const targetStatus = over.id as ProjectStatus
    const project = projects.find((p) => p.id === projectId)

    if (!project || !canDrop(project, targetStatus)) return

    // Optimistic update
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status: targetStatus } : p))
    )

    await fetch(`/api/projects/${projectId}/phase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: targetStatus }),
    })
    void refresh()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <ReadyShelf projects={readyProjects} onStatusChange={handleStatusChange} />

      <div className="flex gap-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            projects={byStatus(col.id)}
            isValidTarget={validDropTargets.includes(col.id)}
            isDragging={!!draggingId}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingProject ? (
          <div className="w-[280px] opacity-90 rotate-[2deg] scale-105 shadow-2xl shadow-black/50 pointer-events-none">
            <ProjectCard project={draggingProject} isDragging isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
