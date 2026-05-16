"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useDraggable } from "@dnd-kit/core"
import { Loader2, AlertCircle, MoreHorizontal, Archive, ArchiveRestore } from "lucide-react"
import type { ProjectSummary } from "@/types"
import { PHASE_LABELS } from "@/lib/phase"
import { StatusBadge } from "./status-badge"

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
  isOverlay?: boolean
  onStatusChange?: (projectId: string, newStatus: string) => void
}

export function ProjectCard({ project, isDragging, isOverlay, onStatusChange }: ProjectCardProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const didDrag = useRef(false)
  const menuClicked = useRef(false)
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: project.id,
    disabled: !!isOverlay,
  })
  const { activeJob, status, messageCount, ideationComplete } = project

  const dragStyle = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined
  const isBlocked = activeJob?.status === "BLOCKED"
  const isFailed = activeJob?.status === "FAILED"
  const isAwaitingApproval = activeJob?.status === "AWAITING_APPROVAL"
  const isBuildingTicket =
    activeJob?.phase === "TICKET_CONTEXT_BUILD" &&
    (activeJob.status === "QUEUED" || activeJob.status === "RUNNING")
  const displayStatus = activeJob?.status ?? status

  const isNotStarted = status === "READY" && !activeJob && !ideationComplete && messageCount === 0
  const isIncomplete = status === "READY" && !activeJob && !ideationComplete && messageCount > 0

  const card = (
    <div
      className={[
        "group relative bg-[#0a0a0a] border rounded-lg p-4 transition-colors duration-150 cursor-pointer select-none",
        isBlocked || isFailed ? "border-[#ef4444]" : "border-[#1a1a1a] hover:border-[#333]",
        isDragging ? "opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Three-dot menu */}
      <div data-menu className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
        <div className="relative">
          <button
            onPointerDown={(e) => { e.stopPropagation() }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); menuClicked.current = true; setMenuOpen(!menuOpen) }}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#222] text-[#555] hover:text-white transition-colors duration-150"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onPointerDown={(e) => { e.stopPropagation() }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); menuClicked.current = true; setMenuOpen(false) }}
              />
              <div
                className="absolute right-0 top-7 z-50 w-[130px] bg-[#111] border border-[#222] rounded-lg shadow-xl shadow-black/50 py-1"
                onPointerDown={(e) => { e.stopPropagation() }}
              >
                {status === "ARCHIVED" ? (
                  <button
                    onPointerDown={(e) => { e.stopPropagation() }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); menuClicked.current = true; setMenuOpen(false); onStatusChange?.(project.id, "READY"); fetch(`/api/projects/${project.id}/phase`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "READY" }) }) }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors duration-150"
                  >
                    <ArchiveRestore size={12} />
                    Unarchive
                  </button>
                ) : (
                  <button
                    onPointerDown={(e) => { e.stopPropagation() }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); menuClicked.current = true; setMenuOpen(false); onStatusChange?.(project.id, "ARCHIVED"); fetch(`/api/projects/${project.id}/phase`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ARCHIVED" }) }) }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors duration-150"
                  >
                    <Archive size={12} />
                    Archive
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2 pr-8">
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
          <span className="text-[#555] text-[11px] ml-auto">
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

      {isAwaitingApproval ? (
        <p className="text-[#a855f7] text-[11px] mt-1">tap Approvals →</p>
      ) : null}

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

  const { "aria-describedby": _omit, ...safeAttributes } = attributes
  const onPointerDown = listeners?.onPointerDown

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      {...safeAttributes}
      suppressHydrationWarning
      onPointerDown={(e) => {
        didDrag.current = false
        menuClicked.current = false
        onPointerDown?.(e)
      }}
      onPointerMove={() => { didDrag.current = true }}
      onClick={(e) => {
        if (didDrag.current || menuClicked.current || menuOpen) return
        const target = e.target as HTMLElement
        if (target.closest("[data-menu]")) return
        router.push(`/projects/${project.id}`)
      }}
      onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler<HTMLDivElement>}
      className="block touch-none"
    >
      {card}
    </div>
  )
}
