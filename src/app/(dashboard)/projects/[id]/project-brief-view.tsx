"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, ChevronRight } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { MessageList } from "@/components/chat/message-list"
import { Composer } from "@/components/chat/composer"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ProjectBriefViewProps {
  projectId: string
  projectName: string
  brief: string
  initialMessages: ChatMessage[]
}

export function ProjectBriefView({
  projectId,
  projectName,
  brief,
  initialMessages,
}: ProjectBriefViewProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [forging, setForging] = useState(false)

  async function streamTurn(userMessage: string) {
    if (isStreaming) return
    setIsStreaming(true)

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: userMessage }
    setMessages((prev) => [...prev, userMsg])

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
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        )
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
    if (forging) return
    setForging(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESEARCH" }),
      })
      if (res.ok) router.push("/")
    } finally {
      setForging(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Back row */}
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
          onClick={handleForge}
          disabled={forging}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-[#e5e5e5] transition-colors"
        >
          {forging ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ChevronRight size={14} />
          )}
          Forge
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-[#1a1a1a]">
        {/* Brief panel */}
        <div className="w-1/2 flex-none border-r border-[#1a1a1a] overflow-y-auto p-6">
          <div className="prose prose-invert prose-sm max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-p:text-[#aaa] prose-p:leading-relaxed
            prose-li:text-[#aaa]
            prose-strong:text-white
            prose-code:text-[#e2e8f0] prose-code:bg-[#111] prose-code:px-1 prose-code:rounded
            prose-hr:border-[#1a1a1a]">
            <ReactMarkdown>{brief}</ReactMarkdown>
          </div>
        </div>

        {/* Refinement chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-[#1a1a1a] flex-none">
            <span className="text-[#555] text-xs uppercase tracking-widest">Refine</span>
          </div>
          <MessageList messages={messages} isStreaming={isStreaming} />
          <Composer isDisabled={isStreaming} onSend={streamTurn} />
        </div>
      </div>
    </div>
  )
}
