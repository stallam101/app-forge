"use client"

import { useState } from "react"

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
    <div className="border-t border-[#1a1a1a] p-4">
      <div className="flex gap-3 items-end">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your project idea…"
          rows={3}
          disabled={isDisabled}
          className="flex-1 resize-none bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-4 py-3 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#333] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={isDisabled || !value.trim()}
          className="h-10 px-5 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-[#e5e5e5] transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
