import { readFileSync } from "fs"
import { join } from "path"
import { randomUUID } from "crypto"
import { db } from "./db"
import { decrypt } from "./secrets"
import type { JobPhase } from "@/types"

export const BREV_PHASES: ReadonlySet<JobPhase> = new Set<JobPhase>([
  "TICKET_CONTEXT_BUILD",
  "RESEARCH",
])

export const STUB_BLOCKER_MESSAGE: Record<string, { message: string; required: string }> = {
  GENERATION: {
    message: "Configure GitHub token in Settings to enable this phase",
    required: "GITHUB_TOKEN",
  },
  MAINTAIN_SEO: {
    message: "Configure Vercel token in Settings to enable this phase",
    required: "VERCEL_TOKEN",
  },
  MAINTAIN_AEO: {
    message: "Configure Vercel token in Settings to enable this phase",
    required: "VERCEL_TOKEN",
  },
  MAINTAIN_INCIDENT: {
    message: "Configure PagerDuty webhook in Settings to enable this phase",
    required: "PAGERDUTY_WEBHOOK",
  },
}

const PHASE_TO_CONFIG: Record<string, string> = {
  TICKET_CONTEXT_BUILD: "ticket-context-build",
  RESEARCH: "research",
}

export interface DispatchResult {
  runId: string
}

export async function dispatchToBrev(
  jobId: string,
  phase: JobPhase,
  projectId: string,
): Promise<DispatchResult> {
  const brevUrl = process.env.BREV_AGENT_URL
  if (!brevUrl) {
    throw new Error("BREV_AGENT_URL is not set — cannot dispatch to Brev agent")
  }

  const configName = PHASE_TO_CONFIG[phase]
  if (!configName) {
    throw new Error(`Phase ${phase} is not Brev-dispatchable (no config mapping)`)
  }

  const [job, project] = await Promise.all([
    db.job.findUniqueOrThrow({ where: { id: jobId } }),
    db.project.findUniqueOrThrow({ where: { id: projectId } }),
  ])

  const settings = await db.setting.findMany()
  const secrets: Record<string, string> = {}
  for (const s of settings) {
    try {
      secrets[s.key] = decrypt(s.value)
    } catch {
      secrets[s.key] = s.value
    }
  }

  let openclawConfig = ""
  let agentPrompt = ""
  try {
    const configPath = join(process.cwd(), "configs", "openclaw", `${configName}.json`)
    openclawConfig = readFileSync(configPath, "utf-8")
    const promptPath = join(process.cwd(), "configs", "prompts", `${configName}.md`)
    const promptTemplate = readFileSync(promptPath, "utf-8")
    const baseUrl = process.env.APPFORGE_BASE_URL ?? ""
    agentPrompt = promptTemplate
      .replace(/{PROJECT_ID}/g, projectId)
      .replace(/{S3_PREFIX}/g, project.s3Prefix)
      .replace(/{JOB_ID}/g, jobId)
      .replace(/{CALLBACK_URL}/g, baseUrl)
      .replace(/{JOB_TOKEN}/g, job.jobToken)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to load OpenClaw config/prompt for ${configName}: ${message}`)
  }

  const callbackUrl = process.env.APPFORGE_BASE_URL ?? ""
  const body = {
    jobId,
    phase,
    projectId,
    callbackUrl,
    callbackToken: job.jobToken,
    brief: project.description ?? "",
    openclawConfig,
    agentPrompt,
    env: {
      NVIDIA_API_KEY: secrets.NVIDIA_API_KEY ?? process.env.NVIDIA_API_KEY ?? "",
      NVIDIA_BASE_URL:
        process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
      TAVILY_API_KEY: secrets.TAVILY_API_KEY ?? process.env.TAVILY_API_KEY ?? "",
    },
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (process.env.BREV_AGENT_SECRET) {
    headers["Authorization"] = `Bearer ${process.env.BREV_AGENT_SECRET}`
  }

  const url = `${brevUrl.replace(/\/$/, "")}/run`
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Brev /run request failed: ${message}`)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Brev /run returned ${res.status}: ${text || res.statusText}`)
  }

  let runId = ""
  try {
    const data = (await res.json()) as { runId?: string; ok?: boolean }
    runId = data.runId ?? ""
  } catch {
    // empty body is fine
  }
  if (!runId) runId = randomUUID()

  await db.job.update({
    where: { id: jobId },
    data: { status: "RUNNING", ecsTaskArn: runId },
  })

  return { runId }
}
