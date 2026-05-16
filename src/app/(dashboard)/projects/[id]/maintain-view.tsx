"use client"

import Link from "next/link"
import { ArrowLeft, Lock, ChevronRight, Inbox } from "lucide-react"
import { PhaseTimeline } from "@/components/phase-timeline"

interface RecentActivity {
  id: string
  type: string
  message: string
  createdAt: string
}

interface PendingApproval {
  id: string
  type: string
  summary: string
  createdAt: string
}

interface MaintainViewProps {
  projectName: string
  recentActivity: RecentActivity[]
  pendingApprovals: PendingApproval[]
}

const APPROVAL_TYPE_LABEL: Record<string, string> = {
  SEO_PR: "SEO PR",
  AEO_PR: "AEO PR",
  INCIDENT_FIX: "Incident fix",
  CONTENT_PR: "Content PR",
  DEPENDENCY_BUMP: "Dependency bump",
  X_POST: "X post",
  PHASE_TRANSITION: "Phase transition",
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function MaintainView({
  projectName,
  recentActivity,
  pendingApprovals,
}: MaintainViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4 flex-none">
        <Link href="/" className="flex items-center gap-1.5 text-[#555] hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} />
          Dashboard
        </Link>
        <span className="text-[#333] text-sm">/</span>
        <span className="text-[#888] text-sm">{projectName || "Untitled"}</span>
      </div>

      <div className="mb-6 flex-none">
        <PhaseTimeline currentPhase="MAINTAIN" state={pendingApprovals.length > 0 ? "awaiting_approval" : "idle"} />
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
        {/* Pending approvals */}
        <div className="border border-[#1a1a1a] rounded-lg flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between flex-none">
            <span className="text-[#555] text-xs uppercase tracking-widest">Pending approvals</span>
            <span className="text-[#a855f7] text-xs">{pendingApprovals.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {pendingApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Inbox size={18} className="text-[#333] mb-2" />
                <p className="text-[#555] text-sm">No pending approvals.</p>
              </div>
            ) : (
              pendingApprovals.map((a) => (
                <Link
                  key={a.id}
                  href="/approvals"
                  className="block p-3 rounded-md border border-[#1a1a1a] hover:border-[#333] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-xs font-medium">
                      {APPROVAL_TYPE_LABEL[a.type] ?? a.type}
                    </span>
                    <span className="text-[#555] text-[11px]">{relativeTime(a.createdAt)}</span>
                  </div>
                  <p className="text-[#aaa] text-[13px] leading-snug line-clamp-2">{a.summary}</p>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="border border-[#1a1a1a] rounded-lg flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-[#1a1a1a] flex-none">
            <span className="text-[#555] text-xs uppercase tracking-widest">Recent agent activity</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {recentActivity.length === 0 ? (
              <p className="text-[#555] text-sm">No recent activity.</p>
            ) : (
              recentActivity.map((e) => (
                <div key={e.id} className="flex items-start gap-2 text-[13px] leading-relaxed">
                  <span className="text-[#333] flex-none mt-0.5">›</span>
                  <div className="min-w-0">
                    <p className="text-[#888]">{e.message}</p>
                    <p className="text-[#444] text-[11px] mt-0.5">{relativeTime(e.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Locked CTA */}
      <div className="mt-4 flex-none border border-[#1a1a1a] rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center flex-none">
            <Lock size={14} className="text-[#888]" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">New Maintain runs are locked</p>
            <p className="text-[#888] text-xs mt-0.5">
              Configure your GitHub + Vercel tokens in Settings to enable agentic Maintain runs.
            </p>
          </div>
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#e5e5e5] transition-colors flex-none"
        >
          Open Settings
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}
