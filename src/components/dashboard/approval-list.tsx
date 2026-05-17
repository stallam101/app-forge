"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { CheckCircle2, XCircle, Inbox } from "lucide-react"
import type { ApprovalCardData, ApprovalType } from "@/types"

const TYPE_LABEL: Record<ApprovalType, string> = {
  SEO_PR: "SEO",
  AEO_PR: "AEO",
  INCIDENT_FIX: "Incident",
  CONTENT_PR: "Content",
  DEPENDENCY_BUMP: "Deps",
  X_POST: "X Post",
  PHASE_TRANSITION: "Phase",
  CREDENTIAL_REQUEST: "Credential",
}

const TYPE_STYLE: Record<ApprovalType, string> = {
  SEO_PR: "text-blue-400 bg-blue-500/10",
  AEO_PR: "text-cyan-400 bg-cyan-500/10",
  INCIDENT_FIX: "text-red-400 bg-red-500/10",
  CONTENT_PR: "text-emerald-400 bg-emerald-500/10",
  DEPENDENCY_BUMP: "text-amber-400 bg-amber-500/10",
  X_POST: "text-emerald-400 bg-emerald-500/10",
  PHASE_TRANSITION: "text-blue-400 bg-white/[0.06]",
  CREDENTIAL_REQUEST: "text-violet-400 bg-violet-500/10",
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
  const [cards, setCards] = useState<ApprovalCardData[]>(initial)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Track locally resolved IDs so polls don't restore them before the DB catches up
  const resolvedIds = useRef<Set<string>>(new Set())

  // Poll for new approvals every 5s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/approvals?status=PENDING")
        if (!res.ok) return
        const data = (await res.json()) as Array<{
          id: string
          projectId: string
          project: { name: string }
          title: string
          description: string
          type: ApprovalType
          createdAt: string
        }>
        setCards(
          data
            .filter((a) => !resolvedIds.current.has(a.id))
            .map((a) => ({
              id: a.id,
              projectId: a.projectId,
              projectName: a.project.name,
              title: a.title,
              description: a.description,
              type: a.type,
              createdAt: a.createdAt,
            }))
        )
      } catch {
        // swallow
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  function handleResolved(id: string) {
    resolvedIds.current.add(id)
    setCards((prev) => prev.filter((c) => c.id !== id))
  }

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
        return
      }
      handleResolved(id)
    } catch {
      setError("Network error. Try again.")
    } finally {
      setPendingId(null)
    }
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          <Inbox size={24} className="text-zinc-600" />
        </div>
        <div className="text-center max-w-[360px]">
          <p className="text-zinc-400 text-[15px] font-medium mb-1">All clear</p>
          <p className="text-zinc-600 text-[13px] leading-relaxed">
            When maintain agents propose SEO fixes, dependency bumps, incident patches, or content changes — they appear here for review.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {["SEO Fixes", "Dep Updates", "Incident Patches", "Content PRs", "AEO Schema"].map((tag) => (
            <span key={tag} className="text-[11px] text-zinc-600 bg-white/[0.04] border border-white/[0.04] px-2.5 py-1 rounded-full">{tag}</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="text-red-400 text-xs border border-red-500/30 bg-red-500/10 rounded-xl px-4 py-2.5">{error}</div>
      )}
      {cards.map((c) => {
        const style = TYPE_STYLE[c.type] ?? "text-zinc-400 bg-zinc-500/10"
        const isPending = pendingId === c.id

        return (
          <div
            key={c.id}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.04] transition-all duration-200"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${style}`}>
                {TYPE_LABEL[c.type]}
              </span>
              <Link href={`/projects/${c.projectId}`} className="text-blue-400 text-[12px] font-medium hover:underline">
                {c.projectName}
              </Link>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-600 text-[11px]">{relativeTime(c.createdAt)}</span>
            </div>

            <p className="text-white text-[14px] font-semibold leading-snug">{c.title}</p>
            <p className="text-zinc-400 text-[13px] mt-1.5 line-clamp-3 whitespace-pre-line leading-relaxed">{c.description}</p>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-white/[0.04]">
              <button
                onClick={() => resolve(c.id, "REJECTED")}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.04] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 text-zinc-400 text-[13px] font-medium rounded-xl active:scale-[0.97] transition-all duration-200 disabled:opacity-40"
              >
                <XCircle size={14} />
                Reject
              </button>
              <button
                onClick={() => resolve(c.id, "APPROVED")}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[13px] font-semibold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.97] transition-all duration-200 disabled:opacity-40"
              >
                <CheckCircle2 size={14} />
                {isPending ? "..." : "Approve"}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
