import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type TimelinePhase = "TICKET" | "RESEARCH" | "GENERATION" | "MAINTAIN"
export type TimelineState = "idle" | "running" | "blocked" | "awaiting_approval" | "complete"

interface PhaseTimelineProps {
  currentPhase: TimelinePhase
  state?: TimelineState
}

const PHASES: { key: TimelinePhase; label: string }[] = [
  { key: "TICKET", label: "Ticket" },
  { key: "RESEARCH", label: "Research" },
  { key: "GENERATION", label: "Generation" },
  { key: "MAINTAIN", label: "Maintain" },
]

function statusColor(state: TimelineState): string {
  if (state === "running") return "#22c55e"
  if (state === "blocked") return "#ef4444"
  if (state === "awaiting_approval") return "#a855f7"
  if (state === "complete") return "#22c55e"
  return "#555555"
}

export function PhaseTimeline({ currentPhase, state = "idle" }: PhaseTimelineProps) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase)
  const accent = statusColor(state)

  return (
    <div className="flex items-center gap-2 w-full">
      {PHASES.map((phase, idx) => {
        const isDone = idx < currentIdx
        const isCurrent = idx === currentIdx
        const isFuture = idx > currentIdx

        return (
          <div key={phase.key} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                isCurrent && "border-[#333] bg-[#0a0a0a]",
                isDone && "border-[#1a1a1a] bg-[#0a0a0a]",
                isFuture && "border-[#1a1a1a] bg-transparent"
              )}
              style={{ color: isCurrent ? "#fff" : isDone ? "#888" : "#444" }}
            >
              {isCurrent ? (
                <span className="relative flex h-2 w-2 flex-none">
                  {state === "running" && (
                    <span
                      className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                      style={{ backgroundColor: accent }}
                    />
                  )}
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                </span>
              ) : isDone ? (
                <Check size={11} className="text-[#22c55e]" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-[#1a1a1a] flex-none" />
              )}
              <span>{phase.label}</span>
            </div>
            {idx < PHASES.length - 1 && (
              <div
                className={cn("flex-1 h-px", isDone ? "bg-[#1a1a1a]" : "bg-[#111]")}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
