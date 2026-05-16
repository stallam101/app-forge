"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Lock, ChevronRight, Loader2, RefreshCw, AlertCircle,
  CheckCircle2, PanelRight, FileText, Clock,
} from "lucide-react"
import ReactMarkdown, { type Components } from "react-markdown"
import { PhaseTimeline } from "@/components/phase-timeline"
import type { JobStatus } from "@/types"

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

interface GenerationViewProps {
  projectId: string
  projectName: string
  jobId: string | null
  jobStatus: JobStatus | null
  errorMessage?: string
  hasGithubToken: boolean
}

interface ProgressEvent {
  type: string
  message: string
}

interface ContextFile {
  name: string
  size: number
  lastModified: string
}

export function GenerationView({
  projectId,
  projectName,
  jobId,
  jobStatus: initialStatus,
  errorMessage,
  hasGithubToken,
}: GenerationViewProps) {
  const router = useRouter()
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [status, setStatus] = useState<JobStatus | null>(initialStatus)
  const [retrying, setRetrying] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [files, setFiles] = useState<ContextFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isRunning = status === "RUNNING" || status === "QUEUED"
  const isAwaitingApproval = status === "AWAITING_APPROVAL"
  const isFailed = status === "FAILED"
  const isComplete = status === "COMPLETE"
  const noToken = !hasGithubToken && !jobId

  // Poll context files
  const refreshFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/context-files`)
      if (!res.ok) return
      const data = (await res.json()) as ContextFile[]
      setFiles(data)
    } catch {}
  }, [projectId])

  useEffect(() => {
    if (!isRunning && !isComplete) return
    refreshFiles()
    const interval = setInterval(refreshFiles, 5000)
    return () => clearInterval(interval)
  }, [isRunning, isComplete, refreshFiles])

  // Fetch file content
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

  // SSE stream
  useEffect(() => {
    if (!jobId || !isRunning) return
    const controller = new AbortController()

    async function connect() {
      try {
        const res = await fetch(`/api/jobs/${jobId}/stream`, { signal: controller.signal })
        if (!res.ok || !res.body) return
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            try {
              const payload = JSON.parse(line.slice(6))
              if (payload.type === "complete") { setStatus("COMPLETE"); router.refresh(); return }
              if (payload.type === "error") { setStatus("FAILED"); return }
              if (payload.message) setEvents((prev) => [...prev, { type: payload.type, message: payload.message }])
            } catch {}
          }
        }
      } catch {}
    }

    void connect()
    return () => controller.abort()
  }, [jobId, isRunning, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events])

  async function retry() {
    if (retrying) return
    setRetrying(true)
    setEvents([])
    setStatus("QUEUED")
    try {
      await fetch(`/api/projects/${projectId}/phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "GENERATION" }),
      })
      router.refresh()
    } finally {
      setRetrying(false)
    }
  }

  const timelineState = isComplete ? "complete" : isAwaitingApproval ? "awaiting_approval" : isFailed ? "blocked" : noToken ? "blocked" : isRunning ? "running" : "idle"

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

        {(isRunning || isAwaitingApproval || isComplete || isFailed) && (
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
        )}
      </div>

      <div className="mb-6 flex-none">
        <PhaseTimeline currentPhase="GENERATION" state={timelineState} />
      </div>

      {/* Lock screen */}
      {noToken && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full text-center">
          <div className="w-12 h-12 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center mb-5">
            <Lock size={18} className="text-[#888]" />
          </div>
          <h2 className="text-white text-base font-semibold mb-2">Generation phase is locked</h2>
          <p className="text-[#888] text-sm leading-relaxed mb-8 max-w-sm">
            Add your <span className="text-white font-medium">GitHub token</span> in Settings — AppForge needs push access to scaffold and commit the generated repo.
          </p>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#e5e5e5] transition-colors"
          >
            Open Settings <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Running / queued / failed / complete — with optional sidebar */}
      {!noToken && (
        <div className="flex-1 flex overflow-hidden gap-4">
          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {isRunning && (
              <div className="flex-1 flex flex-col overflow-hidden rounded-lg border border-[#1a1a1a]">
                <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2 flex-none">
                  <Loader2 size={12} className="animate-spin text-[#555]" />
                  <span className="text-[#555] text-xs uppercase tracking-widest">Activity</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {events.length === 0 && (
                    <p className="text-[#555] text-sm">Waiting for agent…</p>
                  )}
                  {events.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
                      <span className="text-[#333] flex-none mt-0.5">›</span>
                      <span className={e.type === "error" ? "text-[#ef4444]" : e.type === "complete" ? "text-[#22c55e]" : "text-[#888]"}>
                        {e.message}
                      </span>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </div>
            )}

            {isAwaitingApproval && (
              <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full text-center">
                <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5">
                  <Clock size={18} className="text-violet-400" />
                </div>
                <h2 className="text-white text-base font-semibold mb-2">Waiting for approval</h2>
                <p className="text-[#888] text-sm leading-relaxed mb-8 max-w-sm">
                  The generation agent has paused and is waiting for your sign-off. Check the Approvals tab to review and continue.
                </p>
                <div className="flex items-center gap-3">
                  <Link
                    href="/approvals"
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#e5e5e5] transition-colors"
                  >
                    View Approvals <ChevronRight size={14} />
                  </Link>
                  <button
                    onClick={retry}
                    disabled={retrying}
                    className="flex items-center gap-2 px-4 py-2.5 border border-[#1a1a1a] text-[#888] text-sm font-medium rounded-lg hover:border-[#333] hover:text-white disabled:opacity-40 transition-colors"
                  >
                    {retrying ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    Retry instead
                  </button>
                </div>
              </div>
            )}

            {isFailed && (
              <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle size={18} className="text-[#ef4444]" />
                  <span className="text-white text-sm font-medium">Generation failed</span>
                </div>
                {errorMessage && <p className="text-[#888] text-sm text-center mb-8 max-w-sm">{errorMessage}</p>}
                <button
                  onClick={retry}
                  disabled={retrying}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-[#e5e5e5] transition-colors"
                >
                  {retrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Retry Generation
                </button>
              </div>
            )}

            {isComplete && (
              <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                </div>
                <h2 className="text-white text-base font-semibold mb-2">Generation complete</h2>
                <p className="text-[#888] text-sm leading-relaxed mb-8 max-w-sm">
                  The app has been scaffolded and committed to GitHub. Drag to <span className="text-white font-medium">Maintain</span> on the dashboard to start the maintenance cycle.
                </p>
                <Link href="/" className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#e5e5e5] transition-colors">
                  Back to Dashboard
                </Link>
              </div>
            )}
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
      )}
    </div>
  )
}
