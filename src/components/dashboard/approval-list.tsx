"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
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
}

const TYPE_STYLE: Record<ApprovalType, string> = {
  SEO_PR: "text-blue-400 bg-blue-500/10",
  AEO_PR: "text-cyan-400 bg-cyan-500/10",
  INCIDENT_FIX: "text-red-400 bg-red-500/10",
  CONTENT_PR: "text-emerald-400 bg-emerald-500/10",
  DEPENDENCY_BUMP: "text-amber-400 bg-amber-500/10",
  X_POST: "text-emerald-400 bg-emerald-500/10",
  PHASE_TRANSITION: "text-blue-400 bg-white/[0.06]",
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

function CredentialCard({
  card,
  onResolved,
}: {
  card: ApprovalCardData
  onResolved: (id: string) => void
}) {
  const [value, setValue] = useState("")
  const [show, setShow] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!value.trim()) { setError("Enter a value before submitting."); return }
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/approvals/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED", credentialValue: value.trim() }),
      })
      if (!res.ok) { setError("Failed to save. Try again."); return }
      onResolved(card.id)
    } catch {
      setError("Network error.")
    } finally {
      setPending(false)
    }
  }

  async function dismiss() {
    setPending(true)
    try {
      await fetch(`/api/approvals/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      })
      onResolved(card.id)
    } finally {
      setPending(false)
    }
  }

  const color = TYPE_COLOR.CREDENTIAL_REQUEST

  return (
    <div className="bg-[#0a0a0a] border border-[#f97316]/30 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: color }} />
          Credential Request
        </span>
        <Link href={`/projects/${card.projectId}`} className="text-[#888] text-[12px] hover:text-white">
          {card.projectName}
        </Link>
        <span className="text-[#555] text-[11px]">· {relativeTime(card.createdAt)}</span>
      </div>

      <p className="text-white text-[14px] font-medium leading-snug">{card.title}</p>
      <p className="text-[#888] text-[12px] mt-1 whitespace-pre-line">{card.description}</p>

      <div className="mt-3 flex flex-col gap-2">
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Paste value here…"
            className="w-full bg-[#111] border border-[#1a1a1a] rounded-md px-3 py-2 text-[13px] text-white placeholder:text-[#444] focus:outline-none focus:border-[#333] pr-9"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {error && <p className="text-[#ef4444] text-[11px]">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={dismiss}
            disabled={pending}
            className="h-7 px-3 rounded-md text-[12px] text-[#888] border border-[#1a1a1a] hover:border-[#333] hover:text-white disabled:opacity-40 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={submit}
            disabled={pending || !value.trim()}
            className="h-7 px-3 rounded-md text-[12px] font-medium text-black bg-white hover:bg-[#ddd] disabled:opacity-40 transition-colors"
          >
            {pending ? "Saving…" : "Save & Approve"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ApprovalList({ initial }: ApprovalListProps) {
  const router = useRouter()
  const [cards, setCards] = useState<ApprovalCardData[]>(initial)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Poll for new approvals every 10s
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
          data.map((a) => ({
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
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  function handleResolved(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id))
    startTransition(() => router.refresh())
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
