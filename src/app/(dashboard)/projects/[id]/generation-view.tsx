"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Lock, ChevronRight, Loader2, RefreshCw, AlertCircle,
  CheckCircle2, Check, FileText, Folder, FolderOpen, ChevronDown, Clock,
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
  em: ({ children }) => <em className="text-[#bbb] italic">{children}</em>,
  code: ({ children }) => <code className="text-[#e2e8f0] bg-[#111] border border-[#222] px-1 py-0.5 rounded text-[12px] font-mono">{children}</code>,
  pre: ({ children }) => <pre className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-3 overflow-x-auto text-[12px] font-mono text-[#e2e8f0]">{children}</pre>,
  hr: () => <hr className="border-[#1a1a1a] my-5" />,
  a: ({ href, children }) => <a href={href} className="text-[#6b9fff] underline underline-offset-2 hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">{children}</a>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-[#333] pl-4 mb-3 text-[#777] italic text-sm">{children}</blockquote>,
  table: ({ children }) => <div className="overflow-x-auto mb-3"><table className="w-full text-sm border-collapse">{children}</table></div>,
  th: ({ children }) => <th className="text-white font-medium text-left px-3 py-2 border border-[#1a1a1a] bg-[#0a0a0a]">{children}</th>,
  td: ({ children }) => <td className="text-[#aaa] px-3 py-2 border border-[#1a1a1a]">{children}</td>,
}

interface GenerationViewProps {
  projectId: string
  projectName: string
  jobId: string | null
  jobStatus: JobStatus | null
  initialEvents?: { type: string; message: string }[]
  hasGithubToken: boolean
}

interface ProgressEvent {
  type: string
  message: string
}

interface FileEntry {
  name: string
  size: number
  lastModified: string
}

// ── File tree ────────────────────────────────────────────────

interface FileNode {
  name: string
  path: string
  type: "file" | "dir"
  children: FileNode[]
  size?: number
}

function buildTree(files: FileEntry[]): FileNode[] {
  const root: FileNode[] = []
  for (const file of files) {
    const parts = file.name.split("/").filter(Boolean)
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const path = parts.slice(0, i + 1).join("/")
      let node = current.find((n) => n.name === part)
      if (!node) {
        node = { name: part, path, type: isFile ? "file" : "dir", children: [], size: isFile ? file.size : undefined }
        current.push(node)
      }
      if (!isFile) current = node.children
    }
  }
  function sort(nodes: FileNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    nodes.forEach((n) => sort(n.children))
  }
  sort(root)
  return root
}

function FileTreeNode({
  node, depth, selectedPath, onSelect,
}: {
  node: FileNode
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(true)
  const indent = depth * 12

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 w-full px-3 py-1 text-[#666] hover:text-white text-xs transition-colors"
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          {open ? <FolderOpen size={13} className="flex-none" /> : <Folder size={13} className="flex-none" />}
          <span className="truncate">{node.name}</span>
          <ChevronDown size={11} className={`flex-none ml-auto transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
        {open && node.children.map((child) => (
          <FileTreeNode key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
        ))}
      </div>
    )
  }

  const active = selectedPath === node.path
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={
        "flex items-center gap-1.5 w-full py-1 text-xs transition-colors truncate " +
        (active ? "bg-[#1a1a1a] text-white" : "text-[#666] hover:text-white hover:bg-[#0f0f0f]")
      }
      style={{ paddingLeft: `${12 + indent}px`, paddingRight: "12px" }}
    >
      <FileText size={13} className="flex-none" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

// ── Main component ───────────────────────────────────────────

export function GenerationView({
  projectId,
  projectName,
  jobId,
  jobStatus: initialStatus,
  initialEvents = [],
  hasGithubToken,
}: GenerationViewProps) {
  const router = useRouter()
  const [events, setEvents] = useState<ProgressEvent[]>(initialEvents)
  const [status, setStatus] = useState<JobStatus | null>(initialStatus)
  const [retrying, setRetrying] = useState(false)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isRunning = status === "RUNNING" || status === "QUEUED"
  const isAwaitingApproval = status === "AWAITING_APPROVAL"
  const isBlocked = status === "BLOCKED"
  const isFailed = status === "FAILED"
  const isComplete = status === "COMPLETE"
  const noToken = !hasGithubToken && !jobId
  const hasJob = !!jobId || !!status

  // Fetch file content
  const fetchContent = useCallback(async (path: string) => {
    setLoadingContent(true)
    setFileContent(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/artifact?key=${encodeURIComponent(path)}`)
      if (!res.ok) return
      const data = (await res.json()) as { content: string | null }
      setFileContent(data.content)
    } finally {
      setLoadingContent(false)
    }
  }, [projectId])

  useEffect(() => {
    if (selectedPath) fetchContent(selectedPath)
  }, [selectedPath, fetchContent])

  // Refresh file list
  const refreshFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/context-files`)
      if (!res.ok) return
      const data = (await res.json()) as FileEntry[]
      setFiles(data)
      if (!selectedPath && data.length > 0) {
        const first = [...data].sort((a, b) => a.name.localeCompare(b.name))[0]
        setSelectedPath(first.name)
      }
    } catch {}
  }, [projectId, selectedPath])

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
          const lines = buf.split("\n\n")
          buf = lines.pop() ?? ""
          for (const line of lines) {
            const match = line.match(/^data: (.+)$/)
            if (!match) continue
            try {
              const payload = JSON.parse(match[1]) as ProgressEvent
              if (payload.type === "complete") { setStatus("COMPLETE"); await refreshFiles(); router.refresh(); return }
              if (payload.type === "error") { setStatus("FAILED"); return }
              if (payload.type === "blocker") { setStatus("BLOCKED"); return }
              if (payload.message) {
                setEvents((prev) => [...prev, { type: payload.type, message: payload.message }])
                if (payload.type === "progress") refreshFiles()
              }
            } catch {}
          }
        }
      } catch {}
    }

    void connect()
    return () => controller.abort()
  }, [jobId, isRunning, refreshFiles, router])

  // Poll files while running
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(refreshFiles, 5000)
    return () => clearInterval(interval)
  }, [isRunning, refreshFiles])

  // Refresh selected file content while running
  useEffect(() => {
    if (!isRunning || !selectedPath) return
    const interval = setInterval(() => fetchContent(selectedPath), 8000)
    return () => clearInterval(interval)
  }, [isRunning, selectedPath, fetchContent])

  // Initial file load
  useEffect(() => {
    if (hasJob) refreshFiles()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const timelineState = isComplete
    ? "complete"
    : isAwaitingApproval
    ? "awaiting_approval"
    : isBlocked
    ? "blocked"
    : isFailed
    ? "blocked"
    : noToken
    ? "blocked"
    : isRunning
    ? "running"
    : "idle"

  const tree = buildTree(files)

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

        {/* Status-specific header actions */}
        {isComplete && (
          <Link href="/" className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#e5e5e5] transition-colors">
            <CheckCircle2 size={14} />
            Back to Dashboard
          </Link>
        )}
        {isAwaitingApproval && (
          <Link href="/approvals" className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#e5e5e5] transition-colors">
            <ChevronRight size={14} />
            View Approvals
          </Link>
        )}
        {isBlocked && (
          <div className="flex items-center gap-2">
            <Link href="/settings" className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#e5e5e5] transition-colors">
              Open Settings
            </Link>
            <button
              onClick={retry}
              disabled={retrying}
              className="flex items-center gap-2 px-4 py-2 border border-[#1a1a1a] text-[#888] text-sm font-medium rounded-lg hover:border-[#333] hover:text-white disabled:opacity-40 transition-colors"
            >
              {retrying ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Retry
            </button>
          </div>
        )}
        {isFailed && (
          <button
            onClick={retry}
            disabled={retrying}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-[#e5e5e5] transition-colors"
          >
            {retrying ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Retry Generation
          </button>
        )}
      </div>

      <div className="mb-4 flex-none">
        <PhaseTimeline currentPhase="GENERATION" state={timelineState} />
      </div>

      {/* Lock screen — no token, no job */}
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

      {/* Three-panel layout — mirrors ResearchView */}
      {!noToken && (
        <div className="flex flex-1 overflow-hidden rounded-lg border border-[#1a1a1a]">
          {/* Activity feed */}
          <div className="w-[280px] flex-none border-r border-[#1a1a1a] flex flex-col min-w-0">
            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between flex-none">
              <span className="text-[#555] text-xs uppercase tracking-widest">Activity</span>
              {isRunning && <Loader2 size={12} className="animate-spin text-[#555]" />}
              {isComplete && <Check size={12} className="text-[#22c55e]" />}
              {isFailed && <AlertCircle size={12} className="text-[#ef4444]" />}
              {isBlocked && <AlertCircle size={12} className="text-amber-400" />}
              {isAwaitingApproval && <Clock size={12} className="text-violet-400" />}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {events.length === 0 && (
                <p className="text-[#555] text-sm">
                  {jobId ? "Waiting for agent…" : "Generation not dispatched yet."}
                </p>
              )}
              {events.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
                  <span className="text-[#333] flex-none mt-0.5">›</span>
                  <span
                    className={
                      e.type === "error" || e.type === "blocker"
                        ? "text-[#ef4444]"
                        : e.type === "complete"
                        ? "text-[#22c55e]"
                        : e.type === "tool_use"
                        ? "text-[#a855f7]"
                        : "text-[#888]"
                    }
                  >
                    {e.message}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* File browser */}
          <div className="flex-1 flex overflow-hidden min-w-0">
            {/* File tree */}
            <div className="w-[200px] flex-none border-r border-[#1a1a1a] flex flex-col overflow-hidden">
              <div className="px-3 py-3 border-b border-[#1a1a1a] flex-none">
                <span className="text-[#555] text-xs uppercase tracking-widest">Context</span>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {tree.length === 0 ? (
                  <p className="text-[#555] text-xs px-3 py-2">No files yet.</p>
                ) : (
                  tree.map((node) => (
                    <FileTreeNode
                      key={node.path}
                      node={node}
                      depth={0}
                      selectedPath={selectedPath}
                      onSelect={setSelectedPath}
                    />
                  ))
                )}
              </div>
            </div>

            {/* File content */}
            <div className="flex-1 overflow-y-auto min-w-0">
              {selectedPath && (
                <div className="px-4 py-2 border-b border-[#1a1a1a] flex items-center gap-2 sticky top-0 bg-[#000]">
                  <FileText size={12} className="text-[#555]" />
                  <span className="text-[#666] text-xs font-mono">{selectedPath}</span>
                </div>
              )}
              <div className="p-6" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                {loadingContent ? (
                  <div className="flex items-center gap-2 text-[#555] text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    Loading…
                  </div>
                ) : fileContent ? (
                  <ReactMarkdown components={mdComponents}>{fileContent}</ReactMarkdown>
                ) : selectedPath ? (
                  <p className="text-[#555] text-sm">File is empty or unavailable.</p>
                ) : (
                  <p className="text-[#555] text-sm">Select a file to view its contents.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
