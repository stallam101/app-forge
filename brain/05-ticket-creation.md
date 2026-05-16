# AppForge — Ticket Creation

## Purpose

Turn a raw idea into a structured product direction through a multi-turn conversation with an OpenClaw agent. Produces the foundation context that Research builds on. One-time and permanent — once submitted, the conversation cannot be revisited.

## Page

Full-page at `/projects/new`. Not a modal.

## Two Steps

### Step 1 — Conversation (interactive)

User ↔ Claude Sonnet. Multi-turn streaming chat via **Vercel AI SDK** (`streamText`). No ECS container per turn — runs directly in a Next.js API route.

Each user message:
1. `POST /api/projects/[id]/chat` — append user message to `Message` table, load conversation history
2. `streamText({ model: claude-sonnet-4-6, system: ticket-creation-prompt, messages })` → streamed to browser
3. Assistant reply saved to `Message` table after stream completes
4. Context panel polls `GET /api/projects/[id]/context-files` for S3 file updates

**First turn** auto-fires when the page loads (empty user message, `turn === 1` flag). Agent opens with: brief acknowledgment + 2–4 clarifying questions.

**Subsequent turns** deepen research as the niche narrows. Agent may present trade-off options, propose niche candidates, validate assumptions.

**Note:** The ticket creation conversation agent does **not** write S3 files during turns. S3 context is built in Step 2 only. The conversation history is stored in Postgres (`Message` table) and serialized to `ideation/conversation.md` before the Step 2 context-build container starts.

**End of conversation:** user clicks **Create Ticket** when satisfied with the direction.

### Step 2 — Autonomous Context Build (triggered on Create Ticket)

After user submits, AppForge:
1. Serializes the full `Message` table conversation into `brief.md` as a raw transcript
2. Creates a `TICKET_CONTEXT_BUILD` job row (status: QUEUED) in Postgres
3. Redirects user to dashboard; ticket appears in **Unforged** shelf with "Building..." state

Vercel Cron picks up the job → launches ECS Fargate task with Nemotron 3 Super 120B via OpenClaw.

The autonomous agent:
1. Reads `brief.md` from S3 (contains the raw conversation transcript)
2. Overwrites `brief.md` with the structured output — **this is the product-direction**:
   - Project Name
   - Problem Statement (pain + who)
   - Core Features (MVP bulleted list)
   - Target Audience
   - Success Metrics
   - Tech Stack
   - Monetization (if discussed)
3. Updates `index.md`, appends to `log.md`
4. Uploads all files to S3

**`brief.md` is the canonical output file from ideation.** It lives at `{S3_PREFIX}/brief.md` (root level, not in any subfolder). All downstream agents (Research, Generation, Maintain) read it as the source of truth for what the project is.

On job completion → ticket shows "Review brief" state. User clicks ticket → sees rendered `brief.md` + refinement chat + "Forge →" button to transition to Research.

## Context Engine — Conversation Turn (Sonnet, no S3 access)

The ticket creation conversation uses Sonnet directly via Vercel AI SDK. The agent has no S3 or file system access during conversation turns.

System prompt: grill-me style — asks exactly ONE question per message, starts with "What are you trying to build?", pushes back on vague answers, goes deep before broad. After 6–10 exchanges, signals readiness to create ticket.

Conversation history is loaded from the Postgres `Message` table on each turn. S3 is not read or written during conversation turns.

On **Create Ticket**: conversation is serialized as a raw transcript and written to `{S3_PREFIX}/brief.md`. The TICKET_CONTEXT_BUILD agent then overwrites it with the structured brief.

## Outputs

```
{S3_PREFIX}/
  brief.md              ← THE product brief (overwritten by context-build agent)
                           Pre-job: raw conversation transcript
                           Post-job: structured brief (name, problem, features, audience, etc.)
  platform-constraints.md
  project-context.md
  index.md
  log.md
```

`brief.md` is the single source of truth for what the project is. No `ideation/` subfolder — everything lives at the project root prefix.

## Blocker Scenarios

| Blocker | Required input |
|---------|---------------|
| Reddit API missing | `REDDIT_API_KEY` |
| X API missing | `X_API_KEY` |
| Idea incoherent after 3 turns | Agent surfaces blocker — user revises or aborts |

## Prompt Template Skeletons

### Conversation Turn (Sonnet system prompt — see `src/app/api/projects/[id]/chat/route.ts`)

Grill-me style: one question at a time, starts with "What are you trying to build?", pushes back on vague answers, goes 6–10 exchanges deep before signaling readiness.

### Context Build (Nemotron — see `configs/prompts/ticket-context-build.md`)

Reads `{S3_PREFIX}/brief.md` (raw conversation transcript), overwrites it with structured brief containing: Project Name, Problem Statement, Core Features, Target Audience, Success Metrics, Tech Stack, Monetization.
