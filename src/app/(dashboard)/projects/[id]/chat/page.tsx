"use client"

import { useState, useEffect, useRef, use } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Send, CheckCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { IdeationMessage } from "@/types"
import { cn } from "@/lib/utils"

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [messages, setMessages] = useState<IdeationMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [projectName, setProjectName] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMessages()
    fetchProject()
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function fetchProject() {
    const res = await fetch(`/api/projects/${id}`)
    const json = await res.json()
    if (json.success) {
      setProjectName(json.data.name)
    }
  }

  async function fetchMessages() {
    const res = await fetch(`/api/projects/${id}/ideation/messages`)
    const json = await res.json()
    if (json.success) {
      setMessages(json.data)
    }
  }

  async function handleSend() {
    if (!input.trim() || isSending) return

    const userMessage = input.trim()
    setInput("")
    setIsSending(true)

    // Optimistic: add user message
    setMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        role: "user",
        content: userMessage,
        createdAt: new Date().toISOString(),
      },
    ])

    const res = await fetch(`/api/projects/${id}/ideation/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage }),
    })

    const json = await res.json()
    if (json.success) {
      await fetchMessages()
    }

    setIsSending(false)
  }

  async function handleFinalize() {
    await fetch(`/api/projects/${id}/ideation/finalize`, { method: "POST" })
    await fetchMessages()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link href="/">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-sm font-medium">{projectName || "Loading..."}</h1>
          <span className="text-xs text-muted-foreground">Ideation Chat</span>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleFinalize}>
            <CheckCircle className="size-3.5" data-icon="inline-start" />
            Finalize
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && !isSending && (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Send a message or click below to start the ideation conversation.
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={() => {
                  setIsSending(true)
                  fetch(`/api/projects/${id}/ideation/message`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: null }),
                  }).then(() => {
                    fetchMessages()
                    setIsSending(false)
                  })
                }}
              >
                Start
              </Button>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-2.5",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                {msg.filesWritten && msg.filesWritten.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.filesWritten.map((file) => (
                      <Badge key={file} variant="secondary" className="text-[10px]">
                        {file}
                      </Badge>
                    ))}
                  </div>
                )}
                <span className="mt-1 block text-[10px] opacity-60">
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-muted px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="animate-bounce text-muted-foreground">●</span>
                  <span className="animate-bounce text-muted-foreground [animation-delay:150ms]">●</span>
                  <span className="animate-bounce text-muted-foreground [animation-delay:300ms]">●</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Textarea
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="min-h-[40px] resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            size="icon"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
