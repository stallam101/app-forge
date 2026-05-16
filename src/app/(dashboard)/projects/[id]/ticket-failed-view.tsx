"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, RefreshCw, AlertCircle } from "lucide-react"

interface TicketFailedViewProps {
  projectId: string
  projectName: string
  errorMessage?: string
}

export function TicketFailedView({ projectId, projectName, errorMessage }: TicketFailedViewProps) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)

  async function handleReforge() {
    if (retrying) return
    setRetrying(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/create-ticket`, { method: "POST" })
      if (res.ok) router.refresh()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6 flex-none">
        <Link href="/" className="flex items-center gap-1.5 text-[#555] hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} />
          Dashboard
        </Link>
        <span className="text-[#333] text-sm">/</span>
        <span className="text-[#888] text-sm">{projectName || "Untitled"}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle size={18} className="text-[#ef4444]" />
          <span className="text-white text-sm font-medium">Ticket build failed</span>
        </div>

        {errorMessage && (
          <p className="text-[#888] text-sm text-center mb-8 max-w-sm">{errorMessage}</p>
        )}

        <button
          onClick={handleReforge}
          disabled={retrying}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-[#e5e5e5] transition-colors"
        >
          {retrying ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Re-forge
        </button>
      </div>
    </div>
  )
}
