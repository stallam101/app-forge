import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs"
import { readFileSync } from "fs"
import { join } from "path"
import { db } from "./db"
import { decrypt } from "./secrets"
import type { JobPhase } from "@/types"

const ecs = new ECSClient({ region: process.env.AWS_REGION ?? "us-east-1" })

const PHASE_TO_CONFIG: Record<string, string> = {
  TICKET_CONTEXT_BUILD: "ticket-context-build",
  RESEARCH: "research",
  GENERATION: "generation",
  MAINTAIN_SEO: "maintain-seo",
  MAINTAIN_AEO: "maintain-seo",
  MAINTAIN_INCIDENT: "maintain-incident",
}

export async function launchECSTask(jobId: string, phase: JobPhase, projectId: string): Promise<string> {
  const [job, project] = await Promise.all([
    db.job.findUniqueOrThrow({ where: { id: jobId } }),
    db.project.findUniqueOrThrow({ where: { id: projectId } }),
  ])

  // Load all settings and decrypt
  const settings = await db.setting.findMany()
  const secrets: Record<string, string> = {}
  for (const s of settings) {
    try {
      secrets[s.key] = decrypt(s.value)
    } catch {
      secrets[s.key] = s.value
    }
  }

  // Load phase config
  const configName = PHASE_TO_CONFIG[phase] ?? "ticket-context-build"
  const configPath = join(process.cwd(), "configs", "openclaw", `${configName}.json`)
  const openclawConfig = readFileSync(configPath, "utf-8")

  // Load and interpolate prompt
  const promptPath = join(process.cwd(), "configs", "prompts", `${configName}.md`)
  const promptTemplate = readFileSync(promptPath, "utf-8")
  const baseUrl = process.env.APPFORGE_BASE_URL ?? ""
  const agentPrompt = promptTemplate
    .replace(/{PROJECT_ID}/g, projectId)
    .replace(/{S3_PREFIX}/g, project.s3Prefix)
    .replace(/{JOB_ID}/g, jobId)
    .replace(/{CALLBACK_URL}/g, baseUrl)
    .replace(/{JOB_TOKEN}/g, job.jobToken)

  const environment = [
    { name: "PROJECT_ID", value: projectId },
    { name: "JOB_ID", value: jobId },
    { name: "JOB_TOKEN", value: job.jobToken },
    { name: "S3_PREFIX", value: project.s3Prefix },
    { name: "APPFORGE_CALLBACK_URL", value: baseUrl },
    { name: "OPENCLAW_CONFIG", value: openclawConfig },
    { name: "AGENT_PROMPT", value: agentPrompt },
    { name: "AWS_REGION", value: process.env.AWS_REGION ?? "us-east-1" },
    { name: "AWS_ACCESS_KEY_ID", value: process.env.AWS_ACCESS_KEY_ID ?? "" },
    { name: "AWS_SECRET_ACCESS_KEY", value: process.env.AWS_SECRET_ACCESS_KEY ?? "" },
    { name: "S3_BUCKET_NAME", value: process.env.S3_BUCKET_NAME ?? "" },
    { name: "NVIDIA_API_KEY", value: process.env.NVIDIA_API_KEY ?? "" },
    { name: "TAVILY_API_KEY", value: process.env.TAVILY_API_KEY ?? "" },
    // Decrypted secrets from Settings table
    ...Object.entries(secrets).map(([name, value]) => ({ name, value })),
  ]

  const cmd = new RunTaskCommand({
    cluster: process.env.ECS_CLUSTER_ARN,
    taskDefinition: process.env.ECS_TASK_DEFINITION_ARN,
    launchType: "FARGATE",
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: [process.env.ECS_SUBNET_ID ?? ""],
        securityGroups: [process.env.ECS_SECURITY_GROUP_ID ?? ""],
        assignPublicIp: "ENABLED",
      },
    },
    overrides: { containerOverrides: [{ name: "appforge-agent", environment }] },
  })

  const result = await ecs.send(cmd)
  const taskArn = result.tasks?.[0]?.taskArn ?? ""

  await db.job.update({
    where: { id: jobId },
    data: { status: "RUNNING", ecsTaskArn: taskArn },
  })

  return taskArn
}
