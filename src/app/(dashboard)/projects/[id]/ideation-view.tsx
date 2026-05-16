"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Zap, Archive, Pencil, Check } from "lucide-react"
import { MessageList } from "@/components/chat/message-list"
import { Composer } from "@/components/chat/composer"
import { ContextPanel } from "@/components/context-panel/context-panel"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

interface IdeationViewProps {
  projectId: string
  projectName: string
  initialMessages: ChatMessage[]
  briefExists: boolean
}

export function IdeationView({
  projectId,
  projectName,
  initialMessages,
  briefExists,
}: IdeationViewProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [forgeReady, setForgeReady] = useState(briefExists)
  const [forging, setForging] = useState(false)
  const [name, setName] = useState(projectName || "Untitled")
  const [isEditingName, setIsEditingName] = useState(false)

  function saveName() {
    setIsEditingName(false)
    const trimmed = name.trim()
    if (!trimmed || trimmed === projectName) return
    fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
  }

  async function streamTurn(userMessage: string) {
    if (isStreaming) return
    setIsStreaming(true)

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: userMessage }])

    const assistantId = `a-${Date.now()}`
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }])

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
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
    if (!forgeReady || forging) return
    setForging(true)
    try {
      if (briefExists) {
        const res = await fetch(`/api/projects/${projectId}/phase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "RESEARCH" }),
        })
        if (res.ok) router.push("/")
      } else {
        const res = await fetch(`/api/projects/${projectId}/create-ticket`, { method: "POST" })
        if (res.ok) router.push("/")
      }
    } finally {
      setForging(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-none">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-[13px] font-medium transition-colors duration-200">
            <ArrowLeft size={15} strokeWidth={2} />
            Dashboard
          </Link>
          <span className="text-zinc-700">/</span>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName()
                  if (e.key === "Escape") { setName(projectName || "Untitled"); setIsEditingName(false) }
                }}
                className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-1 text-white text-[15px] font-semibold focus:outline-none focus:ring-2 focus:ring-white/10 w-[240px]"
              />
              <button onClick={saveName} className="text-blue-400 hover:text-zinc-300"><Check size={16} /></button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="group flex items-center gap-2 text-white text-[15px] font-semibold hover:text-zinc-300 transition-colors duration-200"
            >
              {name}
              <Pencil size={12} className="text-zinc-600 group-hover:text-blue-400 transition-colors duration-200" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetch(`/api/projects/${projectId}/phase`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "ARCHIVED" }),
              })
              router.push("/")
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 text-[13px] font-medium rounded-xl active:scale-[0.97] transition-all duration-200"
          >
            <Archive size={14} strokeWidth={2} />
            Archive
          </button>
          <button
            onClick={handleForge}
            disabled={!forgeReady || forging}
            className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-zinc-200 text-black text-[13px] font-semibold rounded-xl active:scale-[0.97] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {forging ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} strokeWidth={2.5} fill="currentColor" />}
            Forge
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex flex-1 flex-col min-w-0">
          <MessageList messages={messages} isStreaming={isStreaming} />
          <Composer isDisabled={isStreaming} onSend={streamTurn} />
        </div>
        <ContextPanel projectId={projectId} />
      </div>
    </div>
  )
}
