"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import type { ProjectSummary } from "@/types"
import { ProjectCard } from "./project-card"

interface ReadyShelfProps {
  projects: ProjectSummary[]
  onStatusChange?: (projectId: string, newStatus: string) => void
}

export function ReadyShelf({ projects, onStatusChange }: ReadyShelfProps) {
  return (
    <section className="border-b border-[#1a1a1a] pb-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#888] text-xs uppercase tracking-widest">Unforged</span>
        <Link href="/projects/new">
          <button className="flex items-center gap-2 bg-white hover:bg-[#e5e5e5] text-black text-[13px] font-semibold px-4 py-2 rounded-lg active:scale-[0.97] transition-all duration-150">
            <Plus size={15} strokeWidth={2.5} />
            New Project
          </button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-[#555] text-sm">
          No projects ready.{" "}
          <Link href="/projects/new" className="text-[#888] hover:text-white transition-colors duration-150">
            Create one →
          </Link>
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {projects.map((p) => (
            <div key={p.id} className="w-[280px] flex-none">
              <ProjectCard project={p} onStatusChange={onStatusChange} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
