# AppForge — Core Idea

## What It Is

AppForge is a single-tenant software factory. A developer gives it an idea — as vague as "I want a fintech app" or as specific as a full brief — and AppForge autonomously moves that idea through the entire software development lifecycle: research, build, deploy, and maintain.

Each phase is powered by an OpenClaw agent running in an isolated container. The developer interacts via a kanban board, approving phase transitions and resolving blockers. Otherwise, agents run autonomously.

## Problem It Solves

Building and maintaining software requires constant context-switching: research, planning, coding, testing, deploying, monitoring, marketing. AppForge collapses this into a single interface where agents handle execution and the developer handles decisions.

## Phases

### 1. Ideation
Agent researches the market. Pulls Reddit threads, X posts, competitor analysis. Produces: target audience, competitors, monetization model, tech stack recommendation, feature list. Adapts research depth to input specificity — vague brief → broad market sweep, specific brief → gap-filling only.

### 2. Generation
Agent builds the app. Creates GitHub repo, writes code, runs tests, starts dev servers, pushes commits, deploys to Vercel via GitHub integration. Constrained to what Vercel can host (see platform constraints). Produces: live deployed app, GitHub repo, test report.

### 3. Maintain
Agent runs on cron. Audits SEO, generates AEO content, monitors production via PagerDuty webhooks, opens GitHub PRs with fixes. Auto-merges high-confidence changes (rule-based), flags everything else for approval. Produces: ongoing PRs, approval requests, incident resolutions.

## Core Principles

- **Minimal user input.** Agent infers everything it can.
- **User approves, agent executes.** Phase transitions require human sign-off. Execution is autonomous.
- **Transparent.** Every agent action is cited. PRs are linked. Reasoning is visible.
- **Platform-aware.** Agents know the hosting platform's constraints before they plan or build.
- **Adaptive.** More context from user = less research by agent. Less context = broader sweep.
