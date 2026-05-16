"use client"

interface ContextFileItemProps {
  name: string
  size: number
  lastModified: string
  isNew?: boolean
}

export function ContextFileItem({ name, size, isNew }: ContextFileItemProps) {
  const kb = (size / 1024).toFixed(1)
  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-[#111] rounded-md transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        {isNew && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-none" />}
        <span className="text-[13px] text-[#ccc] truncate font-mono">{name}</span>
      </div>
      <span className="text-[11px] text-[#555] ml-2 flex-none">{kb}kb</span>
    </div>
  )
}
