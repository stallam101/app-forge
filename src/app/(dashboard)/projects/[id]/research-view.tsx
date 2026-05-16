"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, ChevronRight, Check, AlertCircle } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { PhaseTimeline } from "@/components/phase-timeline"
import type { JobStatus } from "@/types"

interface ProgressEvent {
  type: string
  message: string
  metadata?: Record<string, unknown> | null
  createdAt?: string
}

interface ArtifactEntry {
  name: string
  content: string | null
}

interface ResearchViewProps {
  projectId: string
  projectName: string
  jobId: string | null
  initialJobStatus: JobStatus | null
  initialEvents: ProgressEvent[]
  initialArtifacts: ArtifactEntry[]
}

const ARTIFACT_KEYS = [
  "research/findings.md",
  "research/competitors.md",
  "research/market-analysis.md",
  "research/tech-stack.md",
  "research/monetization.md",
  "research/reddit-findings.md",
  "research/features.md",
  "research/x-findings.md",
]

const ARTIFACT_LABELS: Record<string, string> = {
  "research/findings.md": "Findings",
  "research/competitors.md": "Competitors",
  "research/market-analysis.md": "Market",
  "research/tech-stack.md": "Tech stack",
  "research/monetization.md": "Monetization",
  "research/reddit-findings.md": "Reddit",
  "research/features.md": "Features",
  "research/x-findings.md": "X / Twitter",
}

function artifactLabel(key: string): string {
  return ARTIFACT_LABELS[key] ?? key.replace(/^research\//, "").replace(/\.md$/, "")
}

export function ResearchView({
  projectId,
  projectName,
  jobId,
  initialJobStatus,
  initialEvents,
  initialArtifacts,
}: ResearchViewProps) {
  const router = useRouter()
  const [events, setEvents] = useState<ProgressEvent[]>(initialEvents)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(initialJobStatus)
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>(initialArtifacts)
  const [approving, setApproving] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(() => {
    const firstWithContent = initialArtifacts.find((a) => a.content)?.name
    return firstWithContent ?? ARTIFACT_KEYS[0]
  })

  const bottomRef = useRef<HTMLDivElement>(null)

  const isRunning = jobStatus === "QUEUED" || jobStatus === "RUNNING"
  const isComplete = jobStatus === "COMPLETE" || jobStatus === "AWAITING_APPROVAL"
  const isFailed = jobStatus === "FAILED"
  const isBlocked = jobStatus === "BLOCKED"

  // SSE stream from job events
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
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break

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
                router.refresh()
                return
              }
              if (event.type === "error") {
                setJobStatus("FAILED")
                return
              }
              if (event.type === "blocker") {
                setJobStatus("BLOCKED")
                return
              }
              if (event.type === "artifact_written" && typeof event.metadata?.artifact === "string") {
                refetchArtifact(event.metadata.artifact)
              }
            } catch {
              // ignore malformed
            }
          }
        }
      } catch {
        // aborted or connection error
      }
    }

    connect()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, isRunning])

  // Polling fallback: re-fetch the full artifact set every 4s while running
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      refetchAllArtifacts()
    }, 4000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events])

  async function refetchArtifact(key: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/artifact?key=${encodeURIComponent(key)}`)
      if (!res.ok) return
      const data = (await res.json()) as { content: string | null }
      setArtifacts((prev) => {
        const exists = prev.some((a) => a.name === key)
        if (!exists) return [...prev, { name: key, content: data.content }]
        return prev.map((a) => (a.name === key ? { ...a, content: data.content } : a))
      })
    } catch {
      // swallow — polling will retry
    }
  }

  async function refetchAllArtifacts() {
    await Promise.all(ARTIFACT_KEYS.map(refetchArtifact))
  }

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

  const timelineState = isBlocked
    ? "blocked"
    : isComplete
    ? "awaiting_approval"
    : isFailed
    ? "blocked"
    : isRunning
    ? "running"
    : "idle"

  const activeArtifact = artifacts.find((a) => a.name === activeTab)
  const tabsWithAnyContent = ARTIFACT_KEYS.map((key) => {
    const found = artifacts.find((a) => a.name === key)
    return { key, hasContent: Boolean(found?.content) }
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
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

      {/* Main split */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-[#1a1a1a]">
        {/* Activity feed */}
        <div className="w-2/5 flex-none border-r border-[#1a1a1a] flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between flex-none">
            <span className="text-[#555] text-xs uppercase tracking-widest">Activity</span>
            {isRunning && <Loader2 size={12} className="animate-spin text-[#555]" />}
            {isComplete && <Check size={12} className="text-[#22c55e]" />}
            {isFailed && <AlertCircle size={12} className="text-[#ef4444]" />}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {events.length === 0 && (
              <p className="text-[#555] text-sm">
                {jobId ? "Waiting for agent..." : "Research run hasn't been dispatched yet."}
              </p>
            )}
            {events.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
                <span className="text-[#333] flex-none mt-0.5">›</span>
                <span
                  className={
                    e.type === "error"
                      ? "text-[#ef4444]"
                      : e.type === "complete"
                      ? "text-[#22c55e]"
                      : e.type === "blocker"
                      ? "text-[#ef4444]"
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

        {/* Artifacts panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-2 py-2 border-b border-[#1a1a1a] flex items-center gap-1 overflow-x-auto flex-none">
            {tabsWithAnyContent.map(({ key, hasContent }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors " +
                  (activeTab === key
                    ? "bg-[#1a1a1a] text-white"
                    : "text-[#666] hover:text-white hover:bg-[#111]")
                }
              >
                {artifactLabel(key)}
                {hasContent && <span className="w-1 h-1 rounded-full bg-[#22c55e] flex-none" />}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {activeArtifact?.content ? (
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
                <ReactMarkdown>{activeArtifact.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-[#555] text-sm">
                  {isRunning
                    ? "Agent hasn't written this artifact yet…"
                    : "Artifact not available."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
