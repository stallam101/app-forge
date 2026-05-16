# AppForge — Phase: Ideation

## Purpose

Take a user's raw idea — as short as a single sentence — and, through a **back-and-forth conversation** with the agent, validate the market, pin down a niche, and produce a finalized product brief that Generation can build from.

**Ideation is the only interactive phase.** Generation and Maintain run autonomously without further user input (except for blockers and approvals).

## Conversation Model

Ideation is a multi-turn dialogue between user and agent. Each user message triggers a **fresh ECS container** that:

1. Loads the Context Engine (constraints, index, project-context, conversation history)
2. Does whatever research the next turn requires (Reddit, X, web search, competitor scans)
3. Updates wiki files as it learns
4. Posts a single reply message
5. Exits cleanly

Containers do NOT stay warm between turns. Each turn is one ECS RunTask, one container, one reply.

### First turn (auto-fires on phase entry)

When the user drags a project from Backlog → Ideation, the first turn fires automatically — no user message required. The agent:

- Reads `brief.md`
- Does an initial light market sweep (surface the space, not a deep dive)
- Drafts an opening message: brief acknowledgment of what it understood + 2–4 targeted clarifying questions
- Persists message + any initial research files
- Card state → `awaiting message`

### Subsequent turns

User reads the agent's reply in the chat panel, types a response, hits send → new turn fires:

- Container reloads context + full conversation history
- Research deepens as the niche narrows
- Agent may present trade-offs, ask follow-ups, propose 2–3 niche options, validate assumptions
- Each turn may write/update files: `ideation/market-research.md`, `ideation/competitors.md`, `ideation/niches.md`, `ideation/tech-stack-draft.md`, etc.
- Agent decides reply length — short clarifications vs longer research summaries
- Card state → `awaiting message` after each agent reply

### Finalization

The conversation ends in one of two ways:

- **User says "finalize"** — explicit Finalize button in the chat panel
- **Agent proposes finalization** — "I have enough to write a brief — want me to finalize?" → user confirms

On the finalization turn the agent:

1. Writes the full ideation artifact set (see Outputs)
2. Rewrites `project-context.md` with the finalized state
3. Updates `index.md` to register all new files
4. Appends a finalization block to `log.md`
5. Marks the phase job complete

Card moves to `awaiting approval`. User reviews artifacts, approves → project queues for Generation.

## Card States — Ideation Specific

| Badge | Meaning |
|-------|---------|
| `running` | Container is processing — user's message in flight, agent generating reply |
| `awaiting message` | Agent replied — waiting for the user's next message |
| `awaiting approval` | Ideation finalized — user must approve to start Generation |
| `blocked` | Missing API key / decision required outside the conversation |
| `failed` | Container errored — view logs |

## Context Engine — What Agent Loads (every turn)

**Always loaded by AppForge before agent starts:**

- `platform-constraints.md` — never recommend anything outside Vercel limits
- `index.md` — catalog of all context files
- `project-context.md` — current project state (evolves as conversation progresses)
- `ideation/conversation.md` — full turn-by-turn history, AppForge-managed (see Context Engine doc)

**Agent pulls on demand (guided by index):**

- `brief.md` — if original intent needs clarification
- Any ideation file already written — agent can re-read and update its own prior work

## Adaptive Research Depth

The agent decides research depth per turn based on how much the user has constrained the space:

- **Early turns, vague brief** → broad sweep (Reddit trends, X discussions, competitor landscape)
- **Later turns, narrowed niche** → gap-fill only (validate specific assumptions, find direct competitors, confirm market exists)
- **Trivial clarifying turns** → may do zero research, just ask the next question

No user input on research depth — agent is self-directed.

## Research Sources

OpenClaw web search + APIs:

- Reddit (subreddit pain-point mining, sentiment)
- X (trending discussions, founder threads, complaints)
- General web (competitor sites, ProductHunt, App Store reviews, market reports)

All claims cited inline in messages and in wiki files.

## Outputs (final artifact set, written at finalization)

```
ideation/
  conversation.md      ← full chat transcript (AppForge-managed, append-only across turns)
  market-research.md   ← cumulative research findings with citations
  competitors.md       ← competitor matrix
  niches.md            ← niches considered + chosen niche with rationale
  product-brief.md     ← target audience, problem, solution, key constraints
  features.md          ← prioritized MVP feature list
  tech-stack.md        ← recommended stack with WHY rationale
  monetization.md      ← monetization model options + chosen model
```

Additional files if the project warrants it (e.g. `compliance/gdpr.md` for a fintech app). Agent decides.

## Context Engine — Exit Checklist

### Per-turn (non-finalizing)

1. Append a turn block to `log.md` (always)
2. Update `index.md` if new files were written
3. Save updated wiki files to S3
4. Update Postgres `phase_jobs.status` → `awaiting_message`
5. AppForge appends user's message + agent's reply to `ideation/conversation.md` in S3

### Finalization turn

1. Write the full final artifact set (above)
2. Rewrite `project-context.md` — fills What We're Building, Tech Stack (with WHY), Feature Scope checklist, Decision Log
3. Update `index.md` with every file
4. Append finalization block to `log.md`
5. Upload all files to S3
6. Update Postgres `phase_jobs.status` → `complete` (triggers `awaiting approval` card state)

## Blocker Scenarios

| Blocker | Required input |
|---------|---------------|
| Reddit API missing key | `REDDIT_API_KEY` |
| X API missing key | `X_API_KEY` |
| User idea fundamentally incoherent after 3 clarifying turns | Agent surfaces as blocker — user revises brief or aborts |

## Prompt Template Skeleton

```
You are an expert product researcher and market analyst operating within the AppForge Context Engine.
You are in a multi-turn conversation with the user. Your job is to validate their idea, find the right
niche, and produce a finalized product brief.

## Context Engine Instructions
1. Read platform-constraints.md first — never recommend anything outside these limits
2. Read index.md — understand what context exists
3. Read project-context.md — current project state
4. Read ideation/conversation.md — full conversation so far (managed by AppForge, do not write to it directly)
5. Pull additional files from S3 as needed
6. Before exiting: append a turn block to log.md, update index.md if you wrote files,
   and (if finalizing) rewrite project-context.md with full state

## Your Task This Turn
{first_turn ? "Open the conversation: brief acknowledgment + 2–4 clarifying questions, after a light initial research pass."
            : "Read the latest user message at the bottom of ideation/conversation.md. Respond — research, ask follow-ups, propose options, or finalize."}

## Finalization
You decide when to finalize. Two signals:
- User explicitly asks to finalize
- You have enough to write a complete brief — propose finalization and wait for user confirmation

When finalizing, write the full artifact set described in 05-phase-ideation.md.

## Platform Constraints
Read platform-constraints.md. All tech recommendations must stay within these limits.
```
