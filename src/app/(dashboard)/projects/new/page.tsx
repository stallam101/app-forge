"use client"

import { useRef, useState } from "react"
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

  // Modal state
  const [modalName, setModalName] = useState("Untitled")
  const [modalDesc, setModalDesc] = useState("")
  const [modalSubmitted, setModalSubmitted] = useState(false)

  // Chat state
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState("New Project")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [forgeReady, setForgeReady] = useState(false)
  const [forging, setForging] = useState(false)
  const firstTurnFired = useRef(false)

  async function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault()
    setModalSubmitted(true)

    const name = modalName.trim() || "Untitled"
    setProjectName(name)

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: modalDesc.trim() }),
    })
    const { id } = await res.json()
    setProjectId(id)
    history.replaceState(null, "", `/projects/${id}/chat`)

    if (!firstTurnFired.current) {
      firstTurnFired.current = true
      streamTurn(id, "")
    }
  }

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
      {/* Modal */}
      {!modalSubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleModalSubmit}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 w-full max-w-md flex flex-col gap-4"
          >
            <div>
              <h2 className="text-white text-base font-semibold mb-1">New Project</h2>
              <p className="text-[#555] text-sm">Name your project before we start.</p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[#888] text-xs uppercase tracking-widest">Name</label>
              <input
                autoFocus
                type="text"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                placeholder="Untitled"
                className="bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#333] transition-colors placeholder:text-[#444]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[#888] text-xs uppercase tracking-widest">Description <span className="text-[#444] normal-case tracking-normal">(optional)</span></label>
              <textarea
                value={modalDesc}
                onChange={(e) => setModalDesc(e.target.value)}
                placeholder="One line about what you're building"
                rows={2}
                className="bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#333] transition-colors placeholder:text-[#444] resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Link
                href="/"
                className="px-4 py-2 text-[#555] hover:text-white text-sm transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#e5e5e5] transition-colors"
              >
                Start
              </button>
            </div>
          </form>
        </div>
      )}

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
        <span className="text-[#888] text-sm">{projectName}</span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden rounded-lg border border-[#1a1a1a]">
        <div className="flex flex-1 flex-col min-w-0">
          <MessageList messages={messages} isStreaming={isStreaming} />
          <Composer
            isDisabled={!projectId || isStreaming}
            onSend={(msg) => projectId && streamTurn(projectId, msg)}
          />
        </div>
        {projectId && <ContextPanel projectId={projectId} />}
      </div>

      {/* Forge CTA */}
      <div className="flex justify-end mt-4 flex-none">
        <button
          onClick={handleForge}
          disabled={!forgeReady || forging}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-30 hover:bg-[#e5e5e5] transition-colors disabled:cursor-not-allowed"
        >
          {forging ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />}
          Forge
        </button>
      </div>
    </div>
  )
}
