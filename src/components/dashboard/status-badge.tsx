import type { JobStatus, ProjectStatus } from "@/types"

type Status = JobStatus | ProjectStatus

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  READY:             { dot: "#3b82f6", label: "ready" },
  QUEUED:            { dot: "#f59e0b", label: "queued" },
  RUNNING:           { dot: "#22c55e", label: "running" },
  BLOCKED:           { dot: "#ef4444", label: "blocked" },
  FAILED:            { dot: "#ef4444", label: "failed" },
  AWAITING_APPROVAL: { dot: "#a855f7", label: "awaiting approval" },
  COMPLETE:          { dot: "#22c55e", label: "complete" },
  RESEARCH:          { dot: "#3b82f6", label: "research" },
  GENERATION:        { dot: "#a855f7", label: "generation" },
  MAINTAIN:          { dot: "#f59e0b", label: "maintain" },
  ARCHIVED:          { dot: "#555555", label: "archived" },
}

export function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status] ?? { dot: "#555555", label: status.toLowerCase() }

  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: config.dot }}>
      <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ backgroundColor: config.dot }} />
      {config.label}
    </span>
  )
}
