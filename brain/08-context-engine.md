# AppForge — Context Engine

The Context Engine powers all agent intelligence in AppForge. Every phase agent reads from it, writes to it, and leaves it richer than it found it. Based on Karpathy's LLM wiki pattern: immutable raw sources + agent-owned wiki + index as catalog + append-only log.

## Core Idea

Agents don't receive a prescribed file dump. They read the index, decide what's relevant to pull, do their work, write whatever files are useful, cross-link them, and update the index + log before exiting. Context grows organically based on what each project actually needs.

## Seeded Files (AppForge writes at ticket creation)

Five files exist before any agent runs:

```
projects/{project-id}/
  brief.md                  ← raw user input, verbatim. Never modified.
  platform-constraints.md   ← hosting platform limits. Never modified by agents.
  project-context.md        ← front page. Stub at creation, updated each phase.
  index.md                  ← wiki catalog. Stub at creation, agent updates each run.
  log.md                    ← append-only audit trail. Agent appends each run.
```

Everything else is agent-created, agent-named, in whatever folder structure the project needs.

## Agent-Created Files

No prescribed structure. Agent writes what's useful for the project. Examples:

```
ideation/
  conversation.md           ← AppForge-managed (see below), not agent-written
  product-direction.md      ← crystallized output from ticket creation context build
  niches.md                 ← niche options considered during conversation
  initial-research.md       ← light research done during conversation turns
research/
  market-analysis.md        ← market size, trends, opportunity
  competitors.md            ← competitor matrix
  reddit-findings.md        ← Reddit pain points + sentiment
  x-findings.md             ← X discussions + founder threads
  features.md               ← prioritized MVP feature list
  tech-stack.md             ← recommended stack with WHY rationale
  monetization.md           ← monetization model + evidence
known-issues.md             ← living file, created by generation, maintained by maintain
generation/
  spec.md
  deployment.md
maintain/
  seo-audit-2026-05-14.md
  incident-2026-05-10.md
compliance/                 ← fintech project might need this
  gdpr-requirements.md
```

Agent decides what to create. A fintech app context looks different from a social app context.

## ideation/conversation.md — AppForge-managed

The ticket creation conversation between user and agent is stored as a Postgres-backed list of messages (source of truth for UI + SSE) and serialized into `ideation/conversation.md` in S3 before every container spin. The agent **reads** this file each turn but does **not write to it directly** — AppForge owns it.

Format:

```markdown
# {Project Name} — Ideation Conversation

---
turn: 1
role: agent
date: 2026-05-15T12:42:00Z
files_written:
  - ideation/initial-research.md
citations:
  - https://reddit.com/r/freelance/comments/...
---
Brief acknowledgment: budgeting for freelancers, focus on cash flow visibility.
Initial sweep shows three subreddit pain points...

Questions:
1. Are you targeting solo freelancers or agencies (1–10 people)?
2. ...

---
turn: 2
role: user
date: 2026-05-15T12:50:00Z
---
Solo freelancers, mostly creatives. Invoice payment delays are the #1 complaint.

---
turn: 3
role: agent
...
---
```

Every other file under `ideation/` is agent-written and follows normal Context Engine conventions.

## project-context.md (front page)

Always the first content file an agent reads after index. Gives full project understanding in one file.

```markdown
# {Project Name} — Context

## What We're Building
[Validated idea, target audience, core problem solved]
[Seeded by ticket creation context build. Updated by maintain if scope pivots.]

## Tech Stack
[Stack decisions — framework, database, key libraries, hosting]
[Includes WHY — rationale preserved so future agents don't undo intentional choices]
[Written by Research. Updated by Generation if substitutions made.]

## Feature Scope (MVP)
- [ ] Feature A
- [x] Feature B  ← checked off as built
- [ ] Feature C (deferred — see [known-issues.md](known-issues.md))
[Written by Research. Checked off by Generation.]

## Architecture
[Key decisions: data model, auth, API structure, third-party services]
[Written by Generation. Updated by Maintain if changed.]

## Current State
Phase: {research|generation|maintain}
GitHub: {repo URL — added by Generation}
Deployment: {Vercel URL — added by Generation}
Last deploy: {date — updated by Maintain on fix}

## Known Issues / Tech Debt
{N} open issues — see [known-issues.md](known-issues.md)

## Decision Log
[Append-only. Each phase adds entries. Never delete.]
- [ticket-creation 2026-05-14] Confirmed niche: solo freelancer budgeting, not agency — see [ideation/product-direction.md](ideation/product-direction.md)
- [research 2026-05-14] Chose Supabase — realtime required (see [research/tech-stack.md](research/tech-stack.md))
- [generation 2026-05-15] Deferred auth to v2 — see [known-issues.md](known-issues.md)
```

## index.md (wiki catalog)

Agent reads this first on every run. Three fields per entry: path, description, when-to-read. Agent updates this after writing any new file.

```markdown
# {Project Name} — Index

## Always load
- `project-context.md` — current project state, stack, deployment URLs, decision log | load every run
- `platform-constraints.md` — hard hosting limits | load before planning or writing any code

## Raw sources (immutable)
- `brief.md` — original user input | load if unclear on original intent

## Ticket Creation
- `ideation/product-direction.md` — confirmed niche, target audience, problem, constraints | load to understand what to build
- `ideation/conversation.md` — full user↔agent chat transcript | load for deep intent context
- `ideation/niches.md` — niche options considered | load for positioning decisions

## Research
- `research/tech-stack.md` — stack decisions with rationale | load before writing any code
- `research/features.md` — full MVP feature list | load before implementing
- `research/competitors.md` — competitor matrix | load for AEO question generation or positioning
- `research/market-analysis.md` — market findings with citations | load for SEO content or positioning

## Generation
- `generation/spec.md` — what was built, arch decisions, deviations from plan | load for incident diagnosis
- `generation/deployment.md` — GitHub repo URL, Vercel URL, env vars | load for deploy operations
- `known-issues.md` — tech debt, deferred features | load for incident correlation or new feature planning

## Maintain
- `maintain/seo-audit-2026-05-14.md` — SEO findings and actions taken | load for SEO continuity
- `maintain/incident-2026-05-10.md` — DB connection exhaustion, fix applied | load when diagnosing DB errors
```

## log.md (append-only audit trail)

Agent appends a block on every run before exiting. Never edited, only appended.

```markdown
# {Project Name} — Log

---
date: 2026-05-14
phase: ticket-creation-context-build
trigger: user submitted ticket
files_written:
  - ideation/product-direction.md
index_updated: yes
decisions:
  - Confirmed niche: solo freelancer budgeting
  - Target audience: creatives, not agencies
---

---
date: 2026-05-14
phase: research
trigger: user approved
files_written:
  - research/market-analysis.md
  - research/competitors.md
  - research/reddit-findings.md
  - research/features.md
  - research/tech-stack.md
  - research/monetization.md
index_updated: yes
decisions:
  - Chose Supabase over plain Postgres — realtime feature requirement
  - Freemium monetization — evidence from competitor analysis
---

---
date: 2026-05-15
phase: generation
trigger: user approved
files_written:
  - generation/spec.md
  - generation/deployment.md
  - known-issues.md
index_updated: yes
decisions:
  - Deferred auth — out of MVP scope
  - Substituted Vercel Blob for S3 — platform constraint
---
```

## Cross-Linking

Agents write relative markdown links between files when a connection is meaningful.

```markdown
<!-- in research/tech-stack.md -->
Chose Supabase over plain Postgres because the app requires realtime subscriptions
(see [research/features.md#realtime-feed](research/features.md#realtime-feed)).

<!-- in project-context.md decision log -->
- [generation] Deferred auth to v2 — see [known-issues.md](known-issues.md)

<!-- in maintain/incident-2026-05-10.md -->
Root cause correlates with known issue flagged in [known-issues.md#connection-pooling](known-issues.md#connection-pooling).
```

## Prompt Injection Order (every phase)

1. `platform-constraints.md` — internalize hard limits before anything else
2. `index.md` — understand what context exists, decide what to pull
3. `project-context.md` — full project understanding
4. Agent-selected files — whatever the current task requires per the index

## Agent Exit Checklist (every phase)

Before container exits:
1. Append block to `log.md` — always, every run
2. Update `index.md` — register any new files, update descriptions if files changed
3. Update `project-context.md` — **only if something in it actually changed:**
   - Ticket creation context build: always (seeds What We're Building from product-direction.md)
   - Research: always (fills Tech Stack + Feature Scope + Decision Log)
   - Generation: always (fills Architecture, GitHub URL, Deployment URL, checks off features)
   - Maintain cron (SEO/AEO): only if known issues changed or a deploy happened
   - Maintain incident: only if fix was applied (updates Known Issues, Last deploy, Decision Log)
4. Upload all new/modified files to S3
5. Update Postgres job status → `complete`
