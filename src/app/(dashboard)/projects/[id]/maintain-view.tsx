"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Lock, ChevronRight, Inbox, PanelRight, FileText, Loader2 } from "lucide-react"
import ReactMarkdown, { type Components } from "react-markdown"
import { PhaseTimeline } from "@/components/phase-timeline"

const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-white text-xl font-bold mt-6 mb-3 leading-snug border-b border-[#1a1a1a] pb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-white text-base font-semibold mt-5 mb-2 leading-snug">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[#ddd] text-sm font-semibold mt-4 mb-1.5 leading-snug">{children}</h3>,
  p: ({ children }) => <p className="text-[#aaa] text-sm leading-[1.75] mb-3">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 pl-5 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 pl-5 space-y-1 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="text-[#aaa] text-sm leading-[1.6] list-disc">{children}</li>,
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
  code: ({ children }) => <code className="text-[#e2e8f0] bg-[#111] border border-[#222] px-1 py-0.5 rounded text-[12px] font-mono">{children}</code>,
  pre: ({ children }) => <pre className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-3 overflow-x-auto text-[12px] font-mono text-[#e2e8f0]">{children}</pre>,
  hr: () => <hr className="border-[#1a1a1a] my-5" />,
  a: ({ href, children }) => <a href={href} className="text-[#6b9fff] underline underline-offset-2 hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">{children}</a>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-[#333] pl-4 mb-3 text-[#777] italic text-sm">{children}</blockquote>,
}

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

interface ContextFile {
  name: string
  size: number
  lastModified: string
}

interface MaintainViewProps {
  projectId: string
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

export function MaintainView({ projectId, projectName, recentActivity, pendingApprovals }: MaintainViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [files, setFiles] = useState<ContextFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)

  const refreshFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/context-files`)
      if (!res.ok) return
      const data = (await res.json()) as ContextFile[]
      setFiles(data)
    } catch {}
  }, [projectId])

  useEffect(() => {
    refreshFiles()
    const interval = setInterval(refreshFiles, 10000)
    return () => clearInterval(interval)
  }, [refreshFiles])

  const openFile = useCallback(async (name: string) => {
    setSelectedFile(name)
    setLoadingContent(true)
    setFileContent(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/context-files?file=${encodeURIComponent(name)}`)
      if (!res.ok) return
      const data = (await res.json()) as { content: string }
      setFileContent(data.content)
    } finally {
      setLoadingContent(false)
    }
  }, [projectId])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-none">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-[#555] hover:text-white text-sm transition-colors">
            <ArrowLeft size={14} />
            Dashboard
          </Link>
          <span className="text-[#333] text-sm">/</span>
          <span className="text-[#888] text-sm">{projectName || "Untitled"}</span>
        </div>

        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            sidebarOpen
              ? "bg-white/[0.08] text-white border-white/[0.12]"
              : "text-[#666] border-[#1a1a1a] hover:text-white hover:border-[#333]",
          ].join(" ")}
        >
          <PanelRight size={13} />
          Context
          {files.length > 0 && (
            <span className="bg-white/[0.1] text-[#aaa] px-1.5 py-0.5 rounded text-[10px]">{files.length}</span>
          )}
        </button>
      </div>

      <div className="mb-6 flex-none">
        <PhaseTimeline currentPhase="MAINTAIN" state={pendingApprovals.length > 0 ? "awaiting_approval" : "idle"} />
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
          <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden min-h-0">
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
          <div className="flex-none border border-[#1a1a1a] rounded-lg p-4 flex items-center justify-between">
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
              Open Settings <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Context sidebar */}
        {sidebarOpen && (
          <div className="w-[320px] flex-none flex rounded-lg border border-[#1a1a1a] overflow-hidden">
            {selectedFile ? (
              <div className="flex flex-col w-full overflow-hidden">
                <div className="px-3 py-2.5 border-b border-[#1a1a1a] flex items-center gap-2 flex-none">
                  <button
                    onClick={() => { setSelectedFile(null); setFileContent(null) }}
                    className="text-[#555] hover:text-white transition-colors text-xs"
                  >
                    ← Files
                  </button>
                  <span className="text-[#444] text-xs">·</span>
                  <span className="text-[#666] text-xs font-mono truncate">{selectedFile}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  {loadingContent ? (
                    <div className="flex items-center gap-2 text-[#555] text-sm">
                      <Loader2 size={13} className="animate-spin" /> Loading…
                    </div>
                  ) : fileContent ? (
                    <ReactMarkdown components={mdComponents}>{fileContent}</ReactMarkdown>
                  ) : (
                    <p className="text-[#555] text-sm">Empty or unavailable.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col w-full overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between flex-none">
                  <span className="text-[#555] text-xs uppercase tracking-widest">Context</span>
                  {files.length > 0 && <span className="text-[#444] text-[10px]">{files.length} files</span>}
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {files.length === 0 ? (
                    <p className="text-[#555] text-xs px-4 py-3">No context files yet.</p>
                  ) : (
                    files.map((f) => (
                      <button
                        key={f.name}
                        onClick={() => openFile(f.name)}
                        className="flex items-center gap-2.5 w-full px-4 py-2 hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <FileText size={13} className="text-[#555] flex-none" />
                        <span className="text-[13px] text-[#888] truncate font-mono hover:text-white">{f.name}</span>
                        <span className="text-[10px] text-[#444] ml-auto flex-none">{(f.size / 1024).toFixed(1)}kb</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
