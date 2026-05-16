import type { AgentRunOptions, AgentRunResult, Phase } from "@/types"
import { getProjectContextBundle, readContextFile } from "./context"

interface AgentStreamCallbacks {
  onToken?: (token: string) => void
  onLog?: (level: string, message: string) => void
  onComplete?: (result: AgentRunResult) => void
  onError?: (error: string) => void
}

/**
 * Agent runner abstraction.
 * For hackathon: calls Nemotron via OpenClaw CLI or direct API.
 * Production: would trigger ECS Fargate task.
 */
export async function runAgent(
  options: AgentRunOptions,
  callbacks?: AgentStreamCallbacks
): Promise<AgentRunResult> {
  const { projectId, phase } = options

  callbacks?.onLog?.("INFO", `Starting ${phase} agent for project ${projectId}`)

  try {
    const contextBundle = await getProjectContextBundle(projectId)
    const prompt = await buildPrompt(phase, options, contextBundle)

    callbacks?.onLog?.("INFO", `Prompt built (${prompt.length} chars). Invoking agent...`)

    // For hackathon: direct API call to Nemotron/OpenClaw
    // TODO: Replace with actual OpenClaw CLI invocation
    const result = await invokeAgent(prompt, callbacks)

    callbacks?.onLog?.("COMPLETE", `Agent finished. Output: ${result.output.length} chars`)
    callbacks?.onComplete?.(result)

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    callbacks?.onError?.(errorMessage)
    callbacks?.onLog?.("ERROR", errorMessage)

    return {
      success: false,
      output: "",
      filesWritten: [],
      error: errorMessage,
    }
  }
}

async function buildPrompt(
  phase: Phase,
  options: AgentRunOptions,
  contextBundle: string
): Promise<string> {
  switch (phase) {
    case "IDEATION":
      return buildIdeationPrompt(options, contextBundle)
    case "GENERATION":
      return buildGenerationPrompt(options, contextBundle)
    case "MAINTAIN":
      return buildMaintainPrompt(options, contextBundle)
    default:
      throw new Error(`No agent prompt for phase: ${phase}`)
  }
}

async function buildIdeationPrompt(
  options: AgentRunOptions,
  contextBundle: string
): Promise<string> {
  let conversationHistory = ""
  if (options.projectId) {
    const conv = await readContextFile(options.projectId, "ideation/conversation.md")
    if (conv) conversationHistory = conv
  }

  return `You are an expert product researcher and market analyst operating within the AppForge Context Engine.
You are in a multi-turn conversation with the user. Your job is to validate their idea, find the right niche, and produce a finalized product brief.

## Context
${contextBundle}

## Conversation History
${conversationHistory || "(First turn — no history yet)"}

## User Message
${options.message || "(Auto-triggered first turn — introduce yourself, acknowledge the brief, do initial research, ask 2-4 clarifying questions)"}

## Instructions
- Research the market, identify competitors, validate the niche
- Ask clarifying questions to narrow scope
- Write/update context files as you learn
- Cite sources inline
- Keep responses concise but informative
- If user says "finalize" — write the full artifact set (product-brief.md, features.md, tech-stack.md, competitors.md, monetization.md)

Respond with your message to the user. Be conversational and helpful.`
}

async function buildGenerationPrompt(
  options: AgentRunOptions,
  contextBundle: string
): Promise<string> {
  return `You are an expert software engineer operating within the AppForge Context Engine.

## Context
${contextBundle}

## Instructions
Build the application described in project-context.md. Deploy to GitHub and Vercel.
1. Read ideation artifacts (product-brief, features, tech-stack)
2. Confirm stack is platform-compliant
3. Create GitHub repo, scaffold project
4. Implement MVP features one by one
5. Write tests, run them, iterate on failures
6. Push to GitHub (Vercel auto-deploys)
7. Verify deployment URL is live
8. Write generation artifacts (spec.md, deployment.md, known-issues.md)

Document all deviations in project-context.md decision log.`
}

async function buildMaintainPrompt(
  options: AgentRunOptions,
  contextBundle: string
): Promise<string> {
  return `You are an expert site reliability and growth engineer operating within the AppForge Context Engine.

## Context
${contextBundle}

## Instructions
Run a maintenance audit on the deployed application:
1. Fetch the deployed URL from generation/deployment.md
2. Crawl the site — check meta tags, OG tags, sitemap, robots.txt
3. Run SEO audit — identify missing/poor meta descriptions, title tags, h1 structure
4. Check for structured data (JSON-LD) gaps
5. Identify content freshness issues
6. For each issue: generate a fix as a GitHub PR
7. Write audit report to maintain/seo-audit-{date}.md
8. Apply auto-merge rules for safe changes, flag others for approval`
}

/**
 * Invoke the agent (Nemotron via API or OpenClaw CLI).
 * Hackathon version: placeholder that simulates agent execution.
 * Replace with actual OpenClaw/Nemotron integration.
 */
async function invokeAgent(
  prompt: string,
  callbacks?: AgentStreamCallbacks
): Promise<AgentRunResult> {
  // TODO: Replace with actual Nemotron/OpenClaw API call
  // For now, this is the integration point.
  // The actual implementation will be:
  //
  // Option A: OpenClaw CLI
  //   const proc = spawn("openclaw", ["run", "--prompt-file", promptFile, "--context-dir", contextDir])
  //   stream stdout to callbacks.onToken
  //
  // Option B: Direct Nemotron API
  //   POST to NVIDIA API endpoint with prompt
  //   stream response tokens to callbacks.onToken
  //
  // For hackathon demo, Person 2/3/4 will wire this up with their specific agent logic.

  callbacks?.onToken?.("[Agent integration point — wire Nemotron/OpenClaw here]")

  return {
    success: true,
    output: "[Placeholder — agent not yet wired]",
    filesWritten: [],
  }
}

export { buildIdeationPrompt, buildGenerationPrompt, buildMaintainPrompt }
