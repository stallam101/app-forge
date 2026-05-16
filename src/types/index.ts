export type ProjectStatus = "READY" | "RESEARCH" | "GENERATION" | "MAINTAIN" | "ARCHIVED"
export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETE"
  | "FAILED"
  | "BLOCKED"
  | "AWAITING_APPROVAL"
export type JobPhase =
  | "TICKET_CONTEXT_BUILD"
  | "RESEARCH"
  | "GENERATION"
  | "MAINTAIN_SEO"
  | "MAINTAIN_AEO"
  | "MAINTAIN_INCIDENT"
export type MessageRole = "user" | "assistant"
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED"
export type ApprovalType =
  | "SEO_PR"
  | "AEO_PR"
  | "INCIDENT_FIX"
  | "CONTENT_PR"
  | "DEPENDENCY_BUMP"
  | "X_POST"
  | "PHASE_TRANSITION"

export interface ProjectSummary {
  id: string
  name: string
  description: string
  status: ProjectStatus
  s3Prefix: string
  createdAt: Date
  updatedAt: Date
  activeJob?: {
    id: string
    phase: JobPhase
    status: JobStatus
    updatedAt: Date
    lastMessage?: string
  }
  messageCount: number
  ideationComplete: boolean
  pendingApprovals?: number
}
