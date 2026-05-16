"use client"

import { useEffect, useRef } from "react"
import { MessageBubble } from "./message-bubble"
import { TypingIndicator } from "./typing-indicator"
import { MessageSquare } from "lucide-react"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
      {messages.length === 0 && !isStreaming && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center">
            <MessageSquare size={24} className="text-zinc-400" />
          </div>
          <div className="text-center">
            <p className="text-zinc-400 text-[15px] font-medium mb-1">Start the conversation</p>
            <p className="text-zinc-600 text-[13px] max-w-[300px]">
              Describe your app idea and the AI will research the market, competitors, and help shape your product
            </p>
          </div>
        </div>
      )}
      {messages.map((m) => (
        <MessageBubble key={m.id} role={m.role} content={m.content} />
      ))}
      {isStreaming && messages.length === 0 && (
        <div className="flex justify-start">
          <TypingIndicator />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
