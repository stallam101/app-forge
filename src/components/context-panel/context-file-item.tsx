"use client"

import { FileText } from "lucide-react"

interface ContextFileItemProps {
  name: string
  size: number
  lastModified: string
  isNew?: boolean
  onClick?: () => void
}

export function ContextFileItem({ name, size, isNew, onClick }: ContextFileItemProps) {
  const kb = (size / 1024).toFixed(1)
  return (
    <div className="flex items-center gap-2.5 py-2 px-3 hover:bg-white/[0.04] rounded-lg transition-colors duration-150">
      <FileText size={14} className="text-zinc-500 flex-none" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isNew && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-none animate-pulse" />}
          <span className="text-[13px] text-zinc-300 truncate font-mono">{name}</span>
        </div>
      </div>
      <span className="text-[10px] text-zinc-600 flex-none">{kb}kb</span>
    </div>
  )
}
