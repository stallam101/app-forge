"use client"

import Link from "next/link"
import { ArrowLeft, Lock, ChevronRight, ArrowRight } from "lucide-react"
import { PhaseTimeline } from "@/components/phase-timeline"

interface GenerationViewProps {
  projectName: string
}

export function GenerationView({ projectName }: GenerationViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4 flex-none">
        <Link href="/" className="flex items-center gap-1.5 text-[#555] hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} />
          Dashboard
        </Link>
        <span className="text-[#333] text-sm">/</span>
        <span className="text-[#888] text-sm">{projectName || "Untitled"}</span>
      </div>

      <div className="mb-6 flex-none">
        <PhaseTimeline currentPhase="GENERATION" state="blocked" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full text-center">
        <div className="w-12 h-12 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center mb-5">
          <Lock size={18} className="text-[#888]" />
        </div>

        <h2 className="text-white text-base font-semibold mb-2">
          Generation phase is locked
        </h2>
        <p className="text-[#888] text-sm leading-relaxed mb-8 max-w-sm">
          To run the Generation agent, configure your{" "}
          <span className="text-white font-medium">GitHub token</span> in Settings.
          AppForge needs push access to scaffold and commit the generated repo.
        </p>

        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#e5e5e5] transition-colors"
          >
            Open Settings
            <ChevronRight size={14} />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-5 py-2.5 border border-[#1a1a1a] text-[#aaa] text-sm font-medium rounded-lg hover:border-[#333] hover:text-white transition-colors"
          >
            <ArrowRight size={14} />
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
