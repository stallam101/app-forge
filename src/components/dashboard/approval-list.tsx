"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { ApprovalCardData, ApprovalType } from "@/types"

const TYPE_LABEL: Record<ApprovalType, string> = {
  SEO_PR: "SEO PR",
  AEO_PR: "AEO PR",
  INCIDENT_FIX: "Incident Fix",
  CONTENT_PR: "Content PR",
  DEPENDENCY_BUMP: "Dependency Bump",
  X_POST: "X Post",
  PHASE_TRANSITION: "Phase Transition",
}

const TYPE_COLOR: Record<ApprovalType, string> = {
  SEO_PR: "#3b82f6",
  AEO_PR: "#3b82f6",
  INCIDENT_FIX: "#ef4444",
  CONTENT_PR: "#22c55e",
  DEPENDENCY_BUMP: "#f59e0b",
  X_POST: "#22c55e",
  PHASE_TRANSITION: "#a855f7",
}

function relativeTime(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface ApprovalListProps {
  initial: ApprovalCardData[]
}

export function ApprovalList({ initial }: ApprovalListProps) {
  const router = useRouter()
  const [cards, setCards] = useState<ApprovalCardData[]>(initial)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function resolve(id: string, status: "APPROVED" | "REJECTED") {
    setPendingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        setError("Failed to update approval. Try again.")
        setPendingId(null)
        return
      }
      setCards((prev) => prev.filter((c) => c.id !== id))
      startTransition(() => router.refresh())
    } catch {
      setError("Network error. Try again.")
    } finally {
      setPendingId(null)
    }
  }

  if (cards.length === 0) {
    return <p className="text-[#555] text-sm">No pending approvals.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="text-[#ef4444] text-xs border border-[#ef4444]/40 bg-[#ef4444]/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {cards.map((c) => {
        const color = TYPE_COLOR[c.type] ?? "#555"
        const isPending = pendingId === c.id
        return (
          <div
            key={c.id}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 transition-colors duration-150 hover:border-[#333]"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-medium uppercase tracking-wide"
                  style={{ color }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                    style={{ backgroundColor: color }}
                  />
                  {TYPE_LABEL[c.type]}
                </span>
                <Link
                  href={`/projects/${c.projectId}`}
                  className="text-[#888] text-[12px] hover:text-white"
                >
                  {c.projectName}
                </Link>
                <span className="text-[#555] text-[11px]">· {relativeTime(c.createdAt)}</span>
              </div>
            </div>

            <p className="text-white text-[14px] font-medium leading-snug">{c.title}</p>
            <p className="text-[#888] text-[12px] mt-1 line-clamp-3 whitespace-pre-line">
              {c.description}
            </p>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => resolve(c.id, "REJECTED")}
                disabled={isPending}
                className="h-7 px-3 rounded-md text-[12px] text-[#888] border border-[#1a1a1a] hover:border-[#333] hover:text-white disabled:opacity-40 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => resolve(c.id, "APPROVED")}
                disabled={isPending}
                className="h-7 px-3 rounded-md text-[12px] font-medium text-black bg-white hover:bg-[#ddd] disabled:opacity-40 transition-colors"
              >
                {isPending ? "…" : "Approve"}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
