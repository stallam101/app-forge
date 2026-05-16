"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"

interface ProgressEvent {
  type: string
  message: string
  createdAt: string
}

interface TicketBuildingViewProps {
  jobId: string
  projectName: string
}

export function TicketBuildingView({ jobId, projectName }: TicketBuildingViewProps) {
  const router = useRouter()
  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [done, setDone] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
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
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break

          buf += decoder.decode(value, { stream: true })
          const lines = buf.split("\n\n")
          buf = lines.pop() ?? ""

          for (const line of lines) {
            const match = line.match(/^data: (.+)$/)
            if (!match) continue
            const event = JSON.parse(match[1]) as ProgressEvent
            setEvents((prev) => [...prev, event])
            if (event.type === "complete" || event.type === "error") {
              setDone(true)
              // Brief is ready — reload page to render it
              setTimeout(() => router.refresh(), 800)
              return
            }
          }
        }
      } catch {
        // Aborted or connection error
      }
    }

    connect()
    return () => controller.abort()
  }, [jobId, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6 flex-none">
        <Link href="/" className="flex items-center gap-1.5 text-[#555] hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} />
          Dashboard
        </Link>
        <span className="text-[#333] text-sm">/</span>
        <span className="text-[#888] text-sm">{projectName || "Untitled"}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          {!done ? (
            <Loader2 size={18} className="animate-spin text-[#555]" />
          ) : (
            <div className="w-[18px] h-[18px] rounded-full bg-[#22c55e] flex items-center justify-center">
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          <span className="text-white text-sm font-medium">
            {done ? "Brief ready" : "Building your ticket..."}
          </span>
        </div>

        <div className="w-full space-y-2">
          {events.map((e, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="text-[#333] flex-none mt-0.5">›</span>
              <span className={e.type === "error" ? "text-[#ef4444]" : "text-[#888]"}>
                {e.message}
              </span>
            </div>
          ))}
          {events.length === 0 && !done && (
            <p className="text-[#555] text-sm text-center">Waiting for agent...</p>
          )}
        </div>

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
