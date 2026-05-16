"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import type { ApprovalCardData, ApprovalType } from "@/types"

const TYPE_LABEL: Record<ApprovalType, string> = {
  SEO_PR: "SEO PR",
  AEO_PR: "AEO PR",
  INCIDENT_FIX: "Incident Fix",
  CONTENT_PR: "Content PR",
  DEPENDENCY_BUMP: "Dependency Bump",
  X_POST: "X Post",
  PHASE_TRANSITION: "Phase Transition",
  CREDENTIAL_REQUEST: "Credential Request",
}

const TYPE_COLOR: Record<ApprovalType, string> = {
  SEO_PR: "#3b82f6",
  AEO_PR: "#3b82f6",
  INCIDENT_FIX: "#ef4444",
  CONTENT_PR: "#22c55e",
  DEPENDENCY_BUMP: "#f59e0b",
  X_POST: "#22c55e",
  PHASE_TRANSITION: "#a855f7",
  CREDENTIAL_REQUEST: "#f97316",
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
        if (c.type === "CREDENTIAL_REQUEST") {
          return <CredentialCard key={c.id} card={c} onResolved={handleResolved} />
        }

        const color = TYPE_COLOR[c.type] ?? "#555"
        const isPending = pendingId === c.id

        return (
          <div
            key={c.id}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 transition-colors duration-150 hover:border-[#333]"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: color }} />
                  {TYPE_LABEL[c.type]}
                </span>
                <Link href={`/projects/${c.projectId}`} className="text-[#888] text-[12px] hover:text-white">
                  {c.projectName}
                </Link>
                <span className="text-[#555] text-[11px]">· {relativeTime(c.createdAt)}</span>
              </div>
            </div>

            <p className="text-white text-[14px] font-medium leading-snug">{c.title}</p>
            <p className="text-[#888] text-[12px] mt-1 line-clamp-3 whitespace-pre-line">{c.description}</p>

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
