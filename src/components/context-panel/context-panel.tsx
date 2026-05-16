"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import ReactMarkdown from "react-markdown"
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
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
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

  async function openFile(name: string) {
    setSelectedFile(name)
    setFileContent(null)
    setLoadingContent(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/context-files?file=${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error()
      const { content } = await res.json()
      setFileContent(content)
    } catch {
      setFileContent("_Failed to load file._")
    } finally {
      setLoadingContent(false)
    }
  }

  return (
    <div className="w-[280px] flex-none border-l border-[#1a1a1a] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
        {selectedFile && (
          <button
            onClick={() => { setSelectedFile(null); setFileContent(null) }}
            className="text-[#555] hover:text-white transition-colors"
          >
            <ArrowLeft size={13} />
          </button>
        )}
        <h2 className="text-[12px] font-medium text-[#888] uppercase tracking-wider truncate">
          {selectedFile ?? "Context Files"}
        </h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {selectedFile ? (
          <div className="p-4">
            {loadingContent ? (
              <p className="text-[12px] text-[#555]">Loading...</p>
            ) : (
              <div className="prose prose-invert prose-xs max-w-none
                prose-headings:text-white prose-headings:font-semibold prose-headings:text-[13px]
                prose-p:text-[#aaa] prose-p:text-[12px] prose-p:leading-relaxed
                prose-li:text-[#aaa] prose-li:text-[12px]
                prose-strong:text-white
                prose-code:text-[#e2e8f0] prose-code:bg-[#111] prose-code:px-1 prose-code:rounded prose-code:text-[11px]
                prose-hr:border-[#1a1a1a]
                prose-a:text-[#888]">
                <ReactMarkdown>{fileContent ?? ""}</ReactMarkdown>
              </div>
            )}
          </div>
        ) : (
          <div className="py-2 px-1">
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
                  onClick={() => openFile(f.name)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
