"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, ChevronRight } from "lucide-react"
import ReactMarkdown, { type Components } from "react-markdown"

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-white text-xl font-bold mt-6 mb-3 leading-snug border-b border-[#1a1a1a] pb-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-white text-base font-semibold mt-5 mb-2 leading-snug">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[#ddd] text-sm font-semibold mt-4 mb-1.5 leading-snug">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-[#aaa] text-sm leading-[1.75] mb-3">{children}</p>
  ),
  ul: ({ children }) => <ul className="mb-3 pl-5 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 pl-5 space-y-1 list-decimal">{children}</ol>,
  li: ({ children }) => (
    <li className="text-[#aaa] text-sm leading-[1.6] list-disc">{children}</li>
  ),
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-[#bbb] italic">{children}</em>,
  code: ({ children }) => (
    <code className="text-[#e2e8f0] bg-[#111] border border-[#222] px-1 py-0.5 rounded text-[13px] font-mono">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 mb-3 overflow-x-auto text-[13px] font-mono text-[#e2e8f0]">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-[#1a1a1a] my-5" />,
  a: ({ href, children }) => (
    <a href={href} className="text-[#6b9fff] underline underline-offset-2 hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#333] pl-4 mb-3 text-[#777] italic text-sm">
      {children}
    </blockquote>
  ),
}
import { MessageList } from "@/components/chat/message-list"
import { Composer } from "@/components/chat/composer"
import { PhaseTimeline } from "@/components/phase-timeline"

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
          Send to Research
        </button>
      </div>

      {/* Phase timeline */}
      <div className="mb-4 flex-none">
        <PhaseTimeline currentPhase="TICKET" state="complete" />
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-[#1a1a1a]">
        {/* Brief panel */}
        <div className="w-1/2 flex-none border-r border-[#1a1a1a] overflow-y-auto p-6 font-sans">
          <ReactMarkdown components={mdComponents}>{brief}</ReactMarkdown>
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
