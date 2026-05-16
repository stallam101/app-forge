"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { ContextFileItem } from "./context-file-item"
import { FileText } from "lucide-react"

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
    return () => { alive = false; clearInterval(id) }
  }, [projectId])

  const hasFiles = files.length > 0

  return (
    <div className={`flex-none border-l border-white/[0.06] flex flex-col bg-white/[0.01] transition-all duration-300 ${hasFiles ? "w-[280px]" : "w-[200px]"}`}>
      <div className="px-4 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <h2 className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Context</h2>
        {hasFiles && (
          <span className="text-[10px] text-zinc-500 bg-white/[0.06] px-2 py-0.5 rounded-full font-medium">{files.length}</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {!hasFiles ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2.5 px-3">
            <FileText size={16} className="text-zinc-700" />
            <p className="text-[11px] text-zinc-600 text-center leading-relaxed">Context files appear here as agents work</p>
          </div>
        ) : (
          files.map((f) => (
            <ContextFileItem key={f.key} name={f.name} size={f.size} lastModified={f.lastModified} isNew={!seenKeys.current.has(f.key)} />
          ))
        )}
      </div>
    </div>
  )
}
