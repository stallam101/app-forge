"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  ChevronRight,
  Check,
  AlertCircle,
  FileText,
  Folder,
  FolderOpen,
  ChevronDown,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { PhaseTimeline } from "@/components/phase-timeline"
import type { JobStatus } from "@/types"

interface ProgressEvent {
  type: string
  message: string
  metadata?: Record<string, unknown> | null
  createdAt?: string
}

interface FileEntry {
  name: string
  size: number
  lastModified: string
}

interface ResearchViewProps {
  projectId: string
  projectName: string
  jobId: string | null
  initialJobStatus: JobStatus | null
  initialEvents: ProgressEvent[]
  initialFiles: FileEntry[]
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

  // Sort: dirs first, then files, both alpha
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
  node,
  depth,
  selectedPath,
  onSelect,
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
          <ChevronDown
            size={11}
            className={`flex-none ml-auto transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>
        {open && node.children.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
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

export function ResearchView({
  projectId,
  projectName,
  jobId,
  initialJobStatus,
  initialEvents,
  initialFiles,
}: ResearchViewProps) {
  const router = useRouter()
  const [events, setEvents] = useState<ProgressEvent[]>(initialEvents)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(initialJobStatus)
  const [files, setFiles] = useState<FileEntry[]>(initialFiles)
  const [selectedPath, setSelectedPath] = useState<string | null>(() => {
    // Auto-select first file
    const sorted = [...initialFiles].sort((a, b) => a.name.localeCompare(b.name))
    return sorted[0]?.name ?? null
  })
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [approving, setApproving] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  const isRunning = jobStatus === "QUEUED" || jobStatus === "RUNNING"
  const isComplete = jobStatus === "COMPLETE" || jobStatus === "AWAITING_APPROVAL"
  const isFailed = jobStatus === "FAILED"
  const isBlocked = jobStatus === "BLOCKED"

  // Fetch file content when selection changes
  const fetchContent = useCallback(
    async (path: string) => {
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
    },
    [projectId]
  )

  useEffect(() => {
    if (selectedPath) fetchContent(selectedPath)
  }, [selectedPath, fetchContent])

  // Refresh file list from context-files API
  const refreshFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/context-files`)
      if (!res.ok) return
      const data = (await res.json()) as { name: string; size: number; lastModified: string }[]
      setFiles(data.map((f) => ({ name: f.name, size: f.size, lastModified: f.lastModified })))
    } catch {
      // swallow
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
          const lines = buf.split("\n\n")
          buf = lines.pop() ?? ""

          for (const line of lines) {
            const match = line.match(/^data: (.+)$/)
            if (!match) continue
            try {
              const event = JSON.parse(match[1]) as ProgressEvent
              setEvents((prev) => [...prev, event])

              if (event.type === "complete") {
                setJobStatus("AWAITING_APPROVAL")
                await refreshFiles()
                router.refresh()
                return
              }
              if (event.type === "error") { setJobStatus("FAILED"); return }
              if (event.type === "blocker") { setJobStatus("BLOCKED"); return }
              if (event.type === "progress") { refreshFiles() }
            } catch {
              // ignore malformed
            }
          }
        }
      } catch {
        // aborted
      }
    }

    connect()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, isRunning])

  // Poll file list while running
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(refreshFiles, 5000)
    return () => clearInterval(interval)
  }, [isRunning, refreshFiles])

  // Refresh content when selected file changes (e.g. agent updated it)
  useEffect(() => {
    if (!isRunning || !selectedPath) return
    const interval = setInterval(() => fetchContent(selectedPath), 8000)
    return () => clearInterval(interval)
  }, [isRunning, selectedPath, fetchContent])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events])

  async function handleApprove() {
    if (approving) return
    setApproving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "GENERATION" }),
      })
      if (res.ok) router.push("/")
    } finally {
      setApproving(false)
    }
  }

  const tree = buildTree(files)

  const timelineState = isBlocked
    ? "blocked"
    : isComplete
    ? "awaiting_approval"
    : isFailed
    ? "blocked"
    : isRunning
    ? "running"
    : "idle"

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

        {isComplete && (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-[#e5e5e5] transition-colors"
          >
            {approving ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
            Approve → Generation
          </button>
        )}
      </div>

      {/* Phase timeline */}
      <div className="mb-4 flex-none">
        <PhaseTimeline currentPhase="RESEARCH" state={timelineState} />
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-[#1a1a1a]">
        {/* Activity feed */}
        <div className="w-[280px] flex-none border-r border-[#1a1a1a] flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between flex-none">
            <span className="text-[#555] text-xs uppercase tracking-widest">Activity</span>
            {isRunning && <Loader2 size={12} className="animate-spin text-[#555]" />}
            {isComplete && <Check size={12} className="text-[#22c55e]" />}
            {isFailed && <AlertCircle size={12} className="text-[#ef4444]" />}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {events.length === 0 && (
              <p className="text-[#555] text-sm">
                {jobId ? "Waiting for agent…" : "Research not dispatched yet."}
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
            <div className="p-6">
              {loadingContent ? (
                <div className="flex items-center gap-2 text-[#555] text-sm">
                  <Loader2 size={14} className="animate-spin" />
                  Loading…
                </div>
              ) : fileContent ? (
                <div
                  className="prose prose-invert prose-sm max-w-none
                    prose-headings:text-white prose-headings:font-semibold
                    prose-p:text-[#aaa] prose-p:leading-relaxed
                    prose-li:text-[#aaa]
                    prose-strong:text-white
                    prose-code:text-[#e2e8f0] prose-code:bg-[#111] prose-code:px-1 prose-code:rounded
                    prose-hr:border-[#1a1a1a]
                    prose-table:text-[13px]
                    prose-th:text-white prose-th:font-medium prose-th:border-[#1a1a1a]
                    prose-td:text-[#aaa] prose-td:border-[#1a1a1a]
                    prose-a:text-[#3b82f6] prose-a:no-underline hover:prose-a:underline"
                >
                  <ReactMarkdown>{fileContent}</ReactMarkdown>
                </div>
              ) : selectedPath ? (
                <p className="text-[#555] text-sm">File is empty or unavailable.</p>
              ) : (
                <p className="text-[#555] text-sm">Select a file to view its contents.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
