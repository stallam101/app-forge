# AppForge — Core Idea

## Hackathon scope (1h)

Research is the qualifying phase: real OpenClaw + Nemotron 3 Super 120B on Brev.dev with live tool use (web search + file write). Ticket-creation chat uses Claude Sonnet via the AI SDK (no autonomous compute). Generation and Maintain are honest stubs in the 1-hour build — full design lives in their phase docs.

See `hackathon-implementation-plan.md` for the 1-hour split.

## What It Is

AppForge is a single-tenant software factory. A developer gives it an idea — as vague as "I want a fintech app" or as specific as a full brief — and AppForge autonomously moves that idea through the entire software development lifecycle: research, build, deploy, and maintain.

Each phase is powered by an OpenClaw agent running on a Brev GPU instance, calling NVIDIA Nemotron via build.nvidia.com. The developer interacts via a kanban board, approving phase transitions and resolving blockers. Otherwise, agents run autonomously.

> **Hackathon scope (2026-05-16):** Only the **Research** phase ships as a real autonomous agent for the NVIDIA / ASUS Cloud Track. Generation and Maintain ship as honest "configure tokens to unlock" UI stubs. See `hackathon-implementation-plan.md` for what's being built right now.

## How a Project Starts

The developer opens `/projects/new` — a full-page conversational interface with an OpenClaw agent. They describe their idea; the agent does light research, asks clarifying questions, narrows the niche across multiple turns. When the developer is satisfied, they submit the ticket. An autonomous context-building step synthesizes the conversation into structured context (`ideation/product-direction.md` + `project-context.md` stub). A toast fires while this runs. When done, the ticket appears in the **Ready** shelf on the kanban.

This conversation is one-time and permanent — once the ticket is created you cannot return to it.

## Three Phases

### 1. Research (autonomous)
Agent takes the product direction from ticket creation and goes deep. Full Reddit/X sweep, competitor matrix, market sizing, tech stack recommendation with rationale, prioritized feature list, monetization model. All findings written to the Context Engine. User approves when done → queues for Generation.

### 2. Generation (autonomous)
Agent builds the app. Creates GitHub repo, writes code, runs tests, deploys to Vercel via GitHub integration. Constrained to what Vercel can host. User approves when done → moves to Maintain.

### 3. Maintain (cron + event-driven)
Agent runs daily. Audits SEO via sitemap-driven Playwright crawl, generates AEO content (FAQ pages + JSON-LD schema), posts to X (with approval gate), monitors production via PagerDuty webhooks. Auto-merges high-confidence changes (rule-based). Flags everything else for approval.

## Core Principles

- **Conversation shapes the idea. Agents execute everything after.** The only user↔agent dialogue is during ticket creation. All three phases run autonomously — user is pinged only for blockers and approvals.
- **User approves, agent executes.** Phase transitions require human sign-off. Execution is autonomous within a phase.
- **Transparent.** Every agent action is cited. PRs are linked. Reasoning is visible.
- **Platform-aware.** Agents know the hosting platform's constraints before they plan or build.
- **Context compounds.** Every phase leaves the Context Engine richer than it found it.
