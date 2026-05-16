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

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h1 className="text-white text-[15px] font-bold mt-5 mb-2 leading-snug border-b border-[#1a1a1a] pb-1.5">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-white text-[13px] font-semibold mt-4 mb-1.5 leading-snug">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[#ddd] text-[12px] font-semibold mt-3 mb-1 leading-snug">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-[#aaa] text-[12px] leading-[1.7] mb-3">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 pl-4 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 pl-4 space-y-1 list-decimal">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-[#aaa] text-[12px] leading-[1.6] list-disc">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-[#bbb] italic">{children}</em>
  ),
  code: ({ children }) => (
    <code className="text-[#e2e8f0] bg-[#111] border border-[#222] px-1 py-0.5 rounded text-[11px] font-mono">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3 mb-3 overflow-x-auto text-[11px] font-mono text-[#e2e8f0]">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-[#1a1a1a] my-4" />,
  a: ({ href, children }) => (
    <a href={href} className="text-[#6b9fff] underline underline-offset-2 hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#333] pl-3 mb-3 text-[#777] italic text-[12px]">
      {children}
    </blockquote>
  ),
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
    <div className="w-[280px] flex-none border-l border-[#1a1a1a] flex flex-col" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2 flex-none">
        {selectedFile && (
          <button
            onClick={() => { setSelectedFile(null); setFileContent(null) }}
            className="text-[#555] hover:text-white transition-colors flex-none"
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
          <div className="px-4 py-4">
            {loadingContent ? (
              <p className="text-[12px] text-[#555]">Loading...</p>
            ) : (
              <ReactMarkdown components={mdComponents}>
                {fileContent ?? ""}
              </ReactMarkdown>
            )}
          </div>
        ) : (
          <div className="py-2 px-1">
            {files.length === 0 ? (
              <p className="text-[12px] text-[#555] px-3 py-4">
                Files will appear here as context is built.
              </p>
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
