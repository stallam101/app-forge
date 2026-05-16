"use client"

import { useState } from "react"
import { Send } from "lucide-react"

interface ComposerProps {
  isDisabled: boolean
  onSend: (message: string) => void
}

export function Composer({ isDisabled, onSend }: ComposerProps) {
  const [value, setValue] = useState("")

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || isDisabled) return
    onSend(trimmed)
    setValue("")
  }

  return (
    <div className="border-t border-white/[0.06] p-4 bg-white/[0.01]">
      <div className="flex gap-3 items-end">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your project idea..."
          rows={3}
          disabled={isDisabled}
          className="flex-1 resize-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-zinc-200 leading-relaxed placeholder-zinc-600 focus:outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10 disabled:opacity-40 transition-all duration-200"
        />
        <button
          type="button"
          onClick={submit}
          disabled={isDisabled || !value.trim()}
          className="h-11 w-11 flex items-center justify-center bg-white hover:bg-zinc-200 text-black rounded-xl disabled:opacity-30 active:scale-[0.95] transition-all duration-200"
        >
          <Send size={16} strokeWidth={2} />
        </button>
      </div>
      <p className="text-zinc-700 text-[11px] mt-2 px-1">Press Enter to send, Shift+Enter for new line</p>
    </div>
  )
}
