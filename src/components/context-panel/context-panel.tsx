"use client"

import { useEffect, useRef, useState } from "react"
import { ContextFileItem } from "./context-file-item"

interface ContextFile {
  key: string
  name: string
  size: number
  lastModified: string
}

interface ContextPanelProps {
  projectId: string
}

export function ContextPanel({ projectId }: ContextPanelProps) {
  const [files, setFiles] = useState<ContextFile[]>([])
  const seenKeys = useRef<Set<string>>(new Set())

  useEffect(() => {
    let alive = true

    async function poll() {
      try {
        const res = await fetch(`/api/projects/${projectId}/context-files`)
        if (!res.ok || !alive) return
        const data: ContextFile[] = await res.json()
        setFiles(data)
        data.forEach((f) => seenKeys.current.add(f.key))
      } catch {}
    }

    poll()
    const id = setInterval(poll, 3000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [projectId])

  return (
    <div className="w-[280px] flex-none border-l border-[#1a1a1a] flex flex-col">
      <div className="px-4 py-3 border-b border-[#1a1a1a]">
        <h2 className="text-[12px] font-medium text-[#888] uppercase tracking-wider">Context Files</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {files.length === 0 ? (
          <p className="text-[12px] text-[#555] px-3 py-4">Files will appear here as context is built.</p>
        ) : (
          files.map((f) => (
            <ContextFileItem
              key={f.key}
              name={f.name}
              size={f.size}
              lastModified={f.lastModified}
              isNew={!seenKeys.current.has(f.key)}
            />
          ))
        )}
      </div>
    </div>
  )
}
