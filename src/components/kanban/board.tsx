"use client"

import { useState, useEffect } from "react"
import { KanbanColumn } from "./column"
import { CreateProjectDialog } from "./create-project-dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { ProjectCard, Phase } from "@/types"
import { PHASE_ORDER, PHASE_LABELS } from "@/types"

export function KanbanBoard() {
  const [projects, setProjects] = useState<ProjectCard[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  async function fetchProjects() {
    const res = await fetch("/api/projects")
    const json = await res.json()
    if (json.success) {
      setProjects(json.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  async function handleMoveProject(projectId: string, newPhase: Phase) {
    // Optimistic update
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, phase: newPhase } : p))
    )

    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: newPhase }),
    })
  }

  async function handleProjectCreated() {
    setIsCreateOpen(false)
    await fetchProjects()
  }

  function projectsByPhase(phase: Phase): ProjectCard[] {
    return projects.filter((p) => p.phase === phase)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading projects...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Projects</h1>
        <Button onClick={() => setIsCreateOpen(true)} size="sm">
          <Plus className="size-4" data-icon="inline-start" />
          New Project
        </Button>
      </div>

      {/* Columns */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {PHASE_ORDER.map((phase) => (
          <KanbanColumn
            key={phase}
            phase={phase}
            label={PHASE_LABELS[phase]}
            projects={projectsByPhase(phase)}
            onMoveProject={handleMoveProject}
          />
        ))}
      </div>

      {/* Create dialog */}
      <CreateProjectDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleProjectCreated}
      />
    </div>
  )
}
