import type { ProjectStatus, JobPhase } from "@/types"

export const STATUS_TO_PHASE: Partial<Record<ProjectStatus, JobPhase>> = {
  RESEARCH: "RESEARCH",
  GENERATION: "GENERATION",
  MAINTAIN: "MAINTAIN_SEO",
}

export const PHASE_LABELS: Record<JobPhase, string> = {
  TICKET_CONTEXT_BUILD: "Ticket Creation",
  RESEARCH: "Research",
  GENERATION: "Generation",
  MAINTAIN_SEO: "Maintain · SEO",
  MAINTAIN_AEO: "Maintain · AEO",
  MAINTAIN_INCIDENT: "Maintain · Incident",
}
