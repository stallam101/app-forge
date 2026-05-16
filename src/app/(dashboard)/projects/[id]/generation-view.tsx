"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Lock, ChevronRight, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"
import { PhaseTimeline } from "@/components/phase-timeline"
import type { JobStatus } from "@/types"

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

export function GenerationView({ projectId, projectName, jobId, jobStatus: initialStatus, errorMessage, hasGithubToken }: GenerationViewProps) {
  const router = useRouter()
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [status, setStatus] = useState<JobStatus | null>(initialStatus)
  const [retrying, setRetrying] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isRunning = status === "RUNNING" || status === "QUEUED"
  const isFailed = status === "FAILED"
  const isComplete = status === "COMPLETE"
  const noToken = !hasGithubToken && !jobId

  useEffect(() => {
    if (!jobId || (!isRunning)) return

    const controller = new AbortController()
    abortRef.current = controller

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
              if (payload.type === "complete") {
                setStatus("COMPLETE")
                router.refresh()
                return
              }
              if (payload.type === "error") {
                setStatus("FAILED")
                return
              }
              if (payload.message) {
                setEvents((prev) => [...prev, { type: payload.type, message: payload.message }])
              }
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
        <PhaseTimeline
          currentPhase="GENERATION"
          state={isComplete ? "complete" : isFailed ? "blocked" : noToken ? "blocked" : "running"}
        />
      </div>

      {/* Lock screen — no GH token */}
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
            Open Settings
            <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Running / queued */}
      {isRunning && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-4 flex-none">
            <Loader2 size={14} className="animate-spin text-[#555]" />
            <span className="text-[#888] text-sm">Generation agent running…</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: "none" }}>
            {events.map((e, i) => (
              <div key={i} className="flex items-start gap-2.5 py-1">
                <span className="w-1 h-1 rounded-full bg-[#555] mt-[7px] flex-none" />
                <p className="text-[#888] text-[13px] leading-relaxed">{e.message}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Failed */}
      {isFailed && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle size={18} className="text-[#ef4444]" />
            <span className="text-white text-sm font-medium">Generation failed</span>
          </div>
          {errorMessage && (
            <p className="text-[#888] text-sm text-center mb-8 max-w-sm">{errorMessage}</p>
          )}
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

      {/* Complete */}
      {isComplete && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
            <CheckCircle2 size={18} className="text-emerald-400" />
          </div>
          <h2 className="text-white text-base font-semibold mb-2">Generation complete</h2>
          <p className="text-[#888] text-sm leading-relaxed mb-8 max-w-sm">
            The app has been scaffolded and committed to GitHub. Drag this project to <span className="text-white font-medium">Maintain</span> to start the maintenance cycle.
          </p>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#e5e5e5] transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      )}
    </div>
  )
}
