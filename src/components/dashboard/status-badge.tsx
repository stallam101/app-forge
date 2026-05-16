import type { JobStatus, ProjectStatus } from "@/types"

type Status = JobStatus | ProjectStatus

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; pulse?: boolean }> = {
  READY:             { color: "text-blue-400",    bg: "bg-blue-500/10",    label: "ready" },
  QUEUED:            { color: "text-amber-400",   bg: "bg-amber-500/10",   label: "queued" },
  RUNNING:           { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "running", pulse: true },
  BLOCKED:           { color: "text-red-400",     bg: "bg-red-500/10",     label: "blocked" },
  FAILED:            { color: "text-red-400",     bg: "bg-red-500/10",     label: "failed" },
  AWAITING_APPROVAL: { color: "text-blue-400",  bg: "bg-white/[0.06]",  label: "review" },
  COMPLETE:          { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "complete" },
  RESEARCH:          { color: "text-blue-400",    bg: "bg-blue-500/10",    label: "research", pulse: true },
  GENERATION:        { color: "text-blue-400",  bg: "bg-white/[0.06]",  label: "building", pulse: true },
  MAINTAIN:          { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "maintaining", pulse: true },
  ARCHIVED:          { color: "text-zinc-500",    bg: "bg-zinc-500/10",    label: "archived" },
}

export function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status] ?? { color: "text-zinc-500", bg: "bg-zinc-500/10", label: status.toLowerCase() }

  return (
    <span className={`inline-flex items-center gap-1.5 ${config.bg} ${config.color} text-[11px] font-semibold px-2 py-0.5 rounded-full`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current flex-none ${config.pulse ? "animate-pulse" : ""}`} />
      {config.label}
    </span>
  )
}
