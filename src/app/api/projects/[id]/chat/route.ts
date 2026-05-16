import { NextRequest } from "next/server"
import { streamText, tool } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

const SYSTEM_PROMPT = `You are a senior software architect helping a developer turn a rough idea into a deployable product. Your job is to propose — not interrogate.

HOW YOU WORK:
1. User describes their idea (one message is enough — don't ask follow-up questions first).
2. You immediately propose a concrete plan: what to build, MVP feature set, and tech stack. Make it specific and opinionated.
3. User reacts — they agree, push back, or change something. You refine.
4. Repeat until they're satisfied.
5. When the plan is settled and the user confirms they're happy, call the \`readyToForge\` tool to enable the Forge button.

PROPOSAL FORMAT (use every time you propose or refine):
**What we're building:** one sentence
**Who it's for:** specific person with specific pain
**MVP features:** 3-5 bullet points — what it does on day one, nothing more
**Stack:** specific choices with brief reason
**Deployment:** how it runs on Vercel

DEPLOYMENT CONSTRAINTS (Vercel — enforce these):
- Serverless functions only — no long-running processes, no background workers
- No persistent disk — use S3/Supabase/Cloudinary for files
- No WebSockets — use Server-Sent Events or polling instead
- Database: Supabase Postgres — never suggest self-hosted DB
- Max function runtime: 60s — if a task takes longer, suggest Inngest or Trigger.dev
- If the user's idea needs something outside these limits, flag it and suggest the Vercel-compatible alternative

RULES:
- Never ask open-ended questions. Make assumptions and state them — user can correct.
- Keep proposals tight. No padding. No "great idea!" filler.
- If the user says "yes" or "looks good" or signals they're happy — call \`readyToForge\` immediately.
- Before calling \`readyToForge\`, end your message with: "Looks good — hit **Forge** to kick things off." Then call the tool.`

type Params = { id: string }

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  const { message } = await req.json()

  const project = await db.project.findUnique({ where: { id } })
  if (!project) return new Response("Not found", { status: 404 })

  const history = await db.message.findMany({
    where: { projectId: id },
    orderBy: { turn: "asc" },
  })

  const nextTurn = history.length + 1
  const isFirstTurn = nextTurn === 1

  if (!isFirstTurn || message) {
    await db.message.create({
      data: {
        projectId: id,
        role: "user",
        content: message ?? "",
        turn: nextTurn,
      },
    })
  }

  const messages = isFirstTurn && !message
    ? [{ role: "user" as const, content: "Hello, I have a new project idea I'd like to discuss." }]
    : [
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        ...(message ? [{ role: "user" as const, content: message }] : []),
      ]

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: SYSTEM_PROMPT,
    messages,
    tools: {
      readyToForge: tool({
        description: "Signal that the project plan is agreed and the user can now forge the app. Call this when the user confirms they are happy with the plan.",
        inputSchema: z.object({
          summary: z.string().describe("One-sentence summary of what we are building"),
        }),
      }),
    },
  })

  // Custom SSE stream: text deltas + readyToForge signal
  const encoder = new TextEncoder()
  let accumulatedText = ""

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            accumulatedText += part.text
            send({ type: "text", chunk: part.text })
          } else if (part.type === "tool-call" && part.toolName === "readyToForge") {
            send({ type: "readyToForge" })
          }
        }
      } finally {
        // Save assistant message to DB
        if (accumulatedText) {
          await db.message.create({
            data: {
              projectId: id,
              role: "assistant",
              content: accumulatedText,
              turn: nextTurn + 1,
            },
          })
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
