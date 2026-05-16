"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Hammer } from "lucide-react"
import { MessageList } from "@/components/chat/message-list"
import { Composer } from "@/components/chat/composer"
import { ContextPanel } from "@/components/context-panel/context-panel"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

export default function NewProjectPage() {
  const router = useRouter()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [forgeReady, setForgeReady] = useState(false)
  const [forging, setForging] = useState(false)
  const initialized = useRef(false)
  const firstTurnFired = useRef(false)

  // Create project on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    fetch("/api/projects", { method: "POST" })
      .then((r) => r.json())
      .then(({ id }) => {
        setProjectId(id)
        history.replaceState(null, "", `/projects/${id}/chat`)
      })
  }, [])

  // Fire first (empty) turn once projectId is ready
  useEffect(() => {
    if (!projectId || firstTurnFired.current) return
    firstTurnFired.current = true
    streamTurn(projectId, "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function streamTurn(pid: string, userMessage: string) {
    if (isStreaming) return
    setIsStreaming(true)

    if (userMessage) {
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: userMessage }])
    }

    const assistantId = `a-${Date.now()}`
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }])

    try {
      const res = await fetch(`/api/projects/${pid}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      })

      if (!res.ok || !res.body) throw new Error("Stream failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        const lines = buf.split("\n")
        buf = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; chunk?: string }
            if (event.type === "text" && event.chunk) {
              accumulated += event.chunk
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
              )
            } else if (event.type === "readyToForge") {
              setForgeReady(true)
            }
          } catch { /* ignore malformed */ }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "Something went wrong. Please try again." } : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  async function handleForge() {
    if (!projectId || forging) return
    setForging(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/create-ticket`, { method: "POST" })
      if (res.ok) router.push("/")
    } finally {
      setForging(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Back row */}
      <div className="flex items-center gap-3 mb-4 flex-none">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[#555] hover:text-white text-sm transition-colors"
        >
          <ArrowLeft size={14} />
          Dashboard
        </Link>
        <span className="text-[#333] text-sm">/</span>
        <span className="text-[#888] text-sm">New Project</span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-[#1a1a1a]">
        {/* Chat column */}
        <div className="flex flex-1 flex-col min-w-0">
          <MessageList messages={messages} isStreaming={isStreaming} />
          <Composer isDisabled={!projectId || isStreaming} onSend={(msg) => projectId && streamTurn(projectId, msg)} />
        </div>

        {/* Context panel */}
        {projectId && <ContextPanel projectId={projectId} />}
      </div>

      {/* Forge CTA */}
      <div className="flex justify-end mt-4 flex-none">
        <button
          onClick={handleForge}
          disabled={!forgeReady || forging}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-30 hover:bg-[#e5e5e5] transition-colors disabled:cursor-not-allowed"
        >
          {forging ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Hammer size={14} />
          )}
          Forge
        </button>
      </div>
    </div>
  )
}
