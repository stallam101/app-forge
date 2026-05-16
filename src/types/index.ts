export type Phase = "BACKLOG" | "IDEATION" | "GENERATION" | "MAINTAIN" | "ARCHIVED"

export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "AWAITING_MESSAGE"
  | "AWAITING_APPROVAL"
  | "BLOCKED"
  | "FAILED"
  | "COMPLETE"

export type LogLevel = "INFO" | "WARN" | "ERROR" | "BLOCKER" | "COMPLETE"

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface ProjectCard {
  id: string
  name: string
  description: string
  phase: Phase
  status?: JobStatus
  lastActivity?: string
  createdAt: string
}

export interface IdeationMessage {
  id: string
  role: "user" | "agent"
  content: string
  citations?: string[]
  filesWritten?: string[]
  createdAt: string
}

export interface ApprovalRequest {
  id: string
  projectId: string
  phase: Phase
  title: string
  summary: string
  reasoning?: string
  prUrl?: string
  diffPreview?: string
  status: ApprovalStatus
  createdAt: string
}

export interface AgentRunOptions {
  projectId: string
  phase: Phase
  trigger?: "cron" | "incident" | "user"
  message?: string
}

export interface AgentRunResult {
  success: boolean
  output: string
  filesWritten: string[]
  error?: string
}

export interface SSEEvent {
  type: "log" | "status" | "message" | "blocker" | "complete" | "error"
  data: Record<string, unknown>
}

export const PHASE_ORDER: Phase[] = ["BACKLOG", "IDEATION", "GENERATION", "MAINTAIN", "ARCHIVED"]

export const PHASE_LABELS: Record<Phase, string> = {
  BACKLOG: "Backlog",
  IDEATION: "Ideation",
  GENERATION: "Generation",
  MAINTAIN: "Maintain",
  ARCHIVED: "Archived",
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  AWAITING_MESSAGE: "Awaiting Message",
  AWAITING_APPROVAL: "Awaiting Approval",
  BLOCKED: "Blocked",
  FAILED: "Failed",
  COMPLETE: "Complete",
}
