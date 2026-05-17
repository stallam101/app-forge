import { readFileSync } from "fs"
import { join } from "path"
import { db } from "./db"
import { decrypt } from "./secrets"
import type { JobPhase } from "@/types"

const PHASE_TO_PROMPT: Record<string, string> = {
  TICKET_CONTEXT_BUILD: "ticket-context-build",
  RESEARCH:             "research",
  GENERATION:           "generation",
  MAINTAIN_SEO:         "maintain-seo",
  MAINTAIN_AEO:         "maintain-seo",
  MAINTAIN_INCIDENT:    "maintain-incident",
}

export async function launchGatewayJob(jobId: string, phase: JobPhase, projectId: string): Promise<void> {
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

  const promptName = PHASE_TO_PROMPT[phase] ?? "ticket-context-build"
  const promptPath = join(process.cwd(), "configs", "prompts", `${promptName}.md`)
  const promptTemplate = readFileSync(promptPath, "utf-8")
  const baseUrl = process.env.APPFORGE_BASE_URL ?? ""

  const prompt = promptTemplate
    .replace(/{PROJECT_ID}/g, projectId)
    .replace(/{S3_PREFIX}/g, project.s3Prefix)
    .replace(/{JOB_ID}/g, jobId)
    .replace(/{CALLBACK_URL}/g, baseUrl)
    .replace(/{JOB_TOKEN}/g, job.jobToken)

  const env: Record<string, string> = {
    PROJECT_ID:              projectId,
    PHASE:                   phase,
    JOB_ID:                  jobId,
    JOB_TOKEN:               job.jobToken,
    S3_PREFIX:               project.s3Prefix,
    APPFORGE_CALLBACK_URL:   baseUrl,
    AWS_REGION:              process.env.AWS_REGION              ?? "us-east-1",
    AWS_ACCESS_KEY_ID:       process.env.AWS_ACCESS_KEY_ID       ?? "",
    AWS_SECRET_ACCESS_KEY:   process.env.AWS_SECRET_ACCESS_KEY   ?? "",
    S3_BUCKET_NAME:          process.env.S3_BUCKET_NAME          ?? "",
    NVIDIA_API_KEY:          process.env.NVIDIA_API_KEY          ?? "",
    TAVILY_API_KEY:          process.env.TAVILY_API_KEY          ?? "",
    ...secrets,
  }

  const gatewayUrl   = process.env.OPENCLAW_GATEWAY_URL   ?? ""
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN ?? ""

  if (!gatewayUrl) throw new Error("OPENCLAW_GATEWAY_URL is not configured")

  const res = await fetch(`${gatewayUrl}/dispatch`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${gatewayToken}`,
    },
    body: JSON.stringify({ jobId, phase, prompt, env }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Gateway dispatch failed: ${res.status} ${text}`)
  }

  await db.job.update({
    where: { id: jobId },
    data:  { status: "RUNNING" },
  })
}
