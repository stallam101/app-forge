"use client"

import { Zap } from "lucide-react"

export function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center flex-none">
        <Zap size={14} className="text-blue-400" strokeWidth={2.5} fill="currentColor" />
      </div>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-zinc-400/60 animate-bounce" />
          <span className="w-2 h-2 rounded-full bg-zinc-400/60 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-zinc-400/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
