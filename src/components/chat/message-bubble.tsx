"use client"

import ReactMarkdown from "react-markdown"

interface MessageBubbleProps {
  role: "user" | "assistant"
  content: string
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-[#111] rounded-lg p-4 max-w-[80%] text-[#ccc] text-sm">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 max-w-[80%] text-[#ccc] text-sm prose prose-invert prose-sm max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
