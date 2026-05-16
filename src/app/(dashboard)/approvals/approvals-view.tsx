"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Search,
  Cpu,
  AlertTriangle,
  FileText,
  Package,
  MessageSquare,
  ArrowRight,
  Inbox,
  Clock,
  CheckCheck,
  XOctagon,
} from "lucide-react"

interface Approval {
  id: string
  projectId: string
  projectName: string
  jobPhase: string | null
  title: string
  description: string
  type: string
  metadata: Record<string, unknown> | null
  status: string
  createdAt: string
  resolvedAt: string | null
}

const TYPE_CONFIG: Record<string, { icon: typeof Shield; label: string; color: string }> = {
  MAINTAIN_SEO:              { icon: Search,       label: "SEO",               color: "text-blue-400 bg-blue-500/10" },
  MAINTAIN_AEO:              { icon: MessageSquare, label: "AEO",              color: "text-cyan-400 bg-cyan-500/10" },
  MAINTAIN_BUNDLE:           { icon: Package,      label: "Bundle Size",       color: "text-amber-400 bg-amber-500/10" },
  MAINTAIN_CONTENT_FRESHNESS:{ icon: FileText,     label: "Content Freshness", color: "text-emerald-400 bg-emerald-500/10" },
  MAINTAIN_COMPETITOR:       { icon: Search,       label: "Competitor Intel",  color: "text-blue-400 bg-white/[0.06]" },
  MAINTAIN_PERFORMANCE:      { icon: Cpu,          label: "Performance",       color: "text-orange-400 bg-orange-500/10" },
  MAINTAIN_INCIDENT:         { icon: AlertTriangle,label: "Incident Fix",      color: "text-red-400 bg-red-500/10" },
  PHASE_TRANSITION:          { icon: ArrowRight,   label: "Phase Transition",  color: "text-blue-400 bg-white/[0.06]" },
}

const TABS = [
  { id: "PENDING",  label: "Pending",  icon: Clock },
  { id: "APPROVED", label: "Approved", icon: CheckCheck },
  { id: "REJECTED", label: "Rejected", icon: XOctagon },
] as const

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface ApprovalsViewProps {
  initialApprovals: Approval[]
}

export function ApprovalsView({ initialApprovals }: ApprovalsViewProps) {
  const router = useRouter()
  const [approvals, setApprovals] = useState(initialApprovals)
  const [activeTab, setActiveTab] = useState<string>("PENDING")
  const [actioning, setActioning] = useState<string | null>(null)

  const filtered = approvals.filter((a) => a.status === activeTab)
  const pendingCount = approvals.filter((a) => a.status === "PENDING").length

  async function handleAction(id: string, action: "APPROVED" | "REJECTED") {
    setActioning(id)
    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: action, resolvedAt: new Date().toISOString() } : a))
    )
    await fetch(`/api/approvals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    })
    setActioning(null)
    router.refresh()
  }

  return (
    <div className="max-w-[900px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-white text-[20px] font-bold tracking-tight mb-1">Approvals</h1>
        <p className="text-zinc-500 text-[13px]">
          Review agent-proposed changes before they go live
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-white/[0.03] rounded-xl p-1 w-fit">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          const count = approvals.filter((a) => a.status === tab.id).length
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                isActive
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <tab.icon size={14} strokeWidth={2} />
              {tab.label}
              {count > 0 && (
                <span className={[
                  "text-[11px] px-1.5 py-0.5 rounded-full font-semibold",
                  isActive && tab.id === "PENDING"
                    ? "bg-white/[0.08] text-blue-400"
                    : "bg-white/[0.06] text-zinc-500",
                ].join(" ")}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <Inbox size={24} className="text-zinc-600" />
          </div>
          <div className="text-center max-w-[360px]">
            <p className="text-zinc-400 text-[15px] font-medium mb-1">
              {activeTab === "PENDING" ? "All clear" : `No ${activeTab.toLowerCase()} approvals`}
            </p>
            <p className="text-zinc-600 text-[13px] leading-relaxed">
              {activeTab === "PENDING"
                ? "When maintain agents propose SEO fixes, dependency bumps, incident patches, or content changes — they'll appear here for your review before going live."
                : "Approvals you've resolved will be listed here for reference."}
            </p>
          </div>
          {activeTab === "PENDING" && (
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {["SEO Fixes", "Dep Updates", "Incident Patches", "Content PRs", "AEO Schema"].map((tag) => (
                <span key={tag} className="text-[11px] text-zinc-600 bg-white/[0.04] border border-white/[0.04] px-2.5 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((approval) => {
            const typeConfig = TYPE_CONFIG[approval.type] ?? {
              icon: FileText,
              label: approval.type,
              color: "text-zinc-400 bg-zinc-500/10",
            }
            const TypeIcon = typeConfig.icon
            const prUrl = approval.metadata?.prUrl as string | undefined
            const diffPreview = approval.metadata?.diffPreview as string | undefined
            const reasoning = approval.metadata?.reasoning as string | undefined

            return (
              <div
                key={approval.id}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.04] transition-all duration-200"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${typeConfig.color}`}>
                      <TypeIcon size={16} strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-white text-[14px] font-semibold leading-tight">
                        {approval.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Link
                          href={`/projects/${approval.projectId}`}
                          className="text-blue-400 text-[12px] font-medium hover:underline"
                        >
                          {approval.projectName}
                        </Link>
                        <span className="text-zinc-700">·</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                        <span className="text-zinc-700">·</span>
                        <span className="text-zinc-600 text-[11px]">{relativeTime(approval.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status indicator for resolved */}
                  {approval.status === "APPROVED" && (
                    <span className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={12} /> Approved
                    </span>
                  )}
                  {approval.status === "REJECTED" && (
                    <span className="flex items-center gap-1.5 text-red-400 text-[11px] font-semibold bg-red-500/10 px-2.5 py-1 rounded-full">
                      <XCircle size={12} /> Rejected
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-zinc-400 text-[13px] leading-relaxed mb-3">
                  {approval.description}
                </p>

                {/* Reasoning (expandable) */}
                {reasoning && (
                  <details className="mb-3 group">
                    <summary className="text-zinc-500 text-[12px] font-medium cursor-pointer hover:text-zinc-300 transition-colors">
                      View reasoning
                    </summary>
                    <div className="mt-2 bg-white/[0.03] border border-white/[0.04] rounded-lg p-3">
                      <p className="text-zinc-400 text-[12px] leading-relaxed whitespace-pre-wrap">{reasoning}</p>
                    </div>
                  </details>
                )}

                {/* Diff preview */}
                {diffPreview && (
                  <details className="mb-3">
                    <summary className="text-zinc-500 text-[12px] font-medium cursor-pointer hover:text-zinc-300 transition-colors">
                      View diff
                    </summary>
                    <div className="mt-2 bg-[#0d1117] border border-white/[0.04] rounded-lg p-3 overflow-x-auto">
                      <pre className="text-[11px] font-mono text-zinc-400 leading-relaxed">{diffPreview}</pre>
                    </div>
                  </details>
                )}

                {/* Actions row */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.04]">
                  {prUrl && (
                    <a
                      href={prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-400 text-[12px] font-medium hover:underline"
                    >
                      <ExternalLink size={12} />
                      View PR
                    </a>
                  )}

                  {approval.status === "PENDING" && (
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => handleAction(approval.id, "REJECTED")}
                        disabled={actioning === approval.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.04] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 text-zinc-400 text-[13px] font-medium rounded-xl active:scale-[0.97] transition-all duration-200 disabled:opacity-40"
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                      <button
                        onClick={() => handleAction(approval.id, "APPROVED")}
                        disabled={actioning === approval.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[13px] font-semibold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.97] transition-all duration-200 disabled:opacity-40"
                      >
                        <CheckCircle2 size={14} />
                        Approve
                      </button>
                    </div>
                  )}

                  {approval.resolvedAt && (
                    <span className="text-zinc-700 text-[11px] ml-auto">
                      Resolved {relativeTime(approval.resolvedAt)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
