"use client"

import ReactMarkdown from "react-markdown"
import { User, Zap } from "lucide-react"

interface MessageBubbleProps {
  role: "user" | "assistant"
  content: string
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (!content || !content.trim()) return null

  if (role === "user") {
    return (
      <div className="flex gap-3 justify-end">
        <div className="bg-white/[0.08] border border-white/[0.06] rounded-2xl rounded-br-md px-4 py-3 max-w-[75%]">
          <p className="text-zinc-200 text-[14px] leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center flex-none mt-0.5">
          <User size={14} className="text-blue-400" strokeWidth={2} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 justify-start">
      <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center flex-none mt-0.5">
        <Zap size={14} className="text-blue-400" strokeWidth={2.5} fill="currentColor" />
      </div>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3 max-w-[75%] prose prose-invert prose-sm max-w-none prose-p:text-zinc-300 prose-p:text-[14px] prose-p:leading-relaxed prose-headings:text-white prose-strong:text-white prose-code:text-zinc-300 prose-code:bg-white/[0.06] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-a:text-blue-400">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
