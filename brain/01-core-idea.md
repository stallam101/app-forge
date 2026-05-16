# AppForge — Core Idea

## What It Is

AppForge is a single-tenant software factory. A developer gives it an idea — as vague as "I want a fintech app" or as specific as a full brief — and AppForge autonomously moves that idea through the entire software development lifecycle: research, build, deploy, and maintain.

Each phase is powered by an OpenClaw agent running in an isolated container. The developer interacts via a kanban board, approving phase transitions and resolving blockers. Otherwise, agents run autonomously.

## Problem It Solves

Building and maintaining software requires constant context-switching: research, planning, coding, testing, deploying, monitoring, marketing. AppForge collapses this into a single interface where agents handle execution and the developer handles decisions.

## Phases

### 1. Ideation (interactive — the only conversational phase)
User starts a back-and-forth conversation with the agent. User gives a one-line idea; the agent does an initial market sweep, asks clarifying questions, presents niche options, and validates assumptions across multiple turns. Each user message triggers a fresh research-capable container — Reddit, X, web search — that updates the project's wiki and replies. The conversation ends when either party signals "finalize." Final output: target audience, niche, competitors, monetization model, tech stack, feature list. After user approval, the project is handed off to Generation.

### 2. Generation
Agent builds the app. Creates GitHub repo, writes code, runs tests, starts dev servers, pushes commits, deploys to Vercel via GitHub integration. Constrained to what Vercel can host (see platform constraints). Produces: live deployed app, GitHub repo, test report.

### 3. Maintain
Agent runs on cron. Audits SEO, generates AEO content, monitors production via PagerDuty webhooks, opens GitHub PRs with fixes. Auto-merges high-confidence changes (rule-based), flags everything else for approval. Produces: ongoing PRs, approval requests, incident resolutions.

## Core Principles

- **Ideation is a dialogue. Everything after is autonomous.** The user converses with the agent only during Ideation, to shape the idea and pick the niche. Generation and Maintain run hands-off — user is pinged only for blockers and approvals.
- **User approves, agent executes.** Phase transitions require human sign-off. Execution is autonomous within a phase.
- **Transparent.** Every agent action is cited. PRs are linked. Reasoning is visible.
- **Platform-aware.** Agents know the hosting platform's constraints before they plan or build.
- **Adaptive research depth.** During Ideation, the agent goes broad on vague turns and gap-fills on specific ones. Across phases, more user-provided context = less agent research.
