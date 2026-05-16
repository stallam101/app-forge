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
  project-context.md        ← front page. Stub at creation, rewritten each phase.
  index.md                  ← wiki catalog. Stub at creation, agent updates each run.
  log.md                    ← append-only audit trail. Agent appends each run.
```

Everything else is agent-created, agent-named, in whatever folder structure the project needs.

## Agent-Created Files

No prescribed structure. Agent writes what's useful for the project. Examples:

```
ideation/
  conversation.md           ← AppForge-managed (see below), not agent-written
  market-research.md
  competitors.md
  niches.md
  tech-stack.md             ← links to features.md where stack choice depends on a feature
  features.md
  product-brief.md
  monetization.md
known-issues.md              ← living file, created by generation, maintained by maintain
generation/
  spec.md
  deployment.md
maintain/
  seo-audit-2026-05-14.md
  incident-2026-05-10.md
compliance/                 ← fintech project might need this
  gdpr-requirements.md
user-research/              ← social app might need this
  interview-findings.md
```

Agent decides what to create. A fintech app context looks different from a social app context.

## ideation/conversation.md — AppForge-managed

Ideation is the only interactive phase. The conversation between user and agent is stored as a Postgres-backed list of messages (source of truth for UI + SSE) and serialized into `ideation/conversation.md` in S3 before every container spin. The ideation agent **reads** this file each turn but does **not write to it directly** — AppForge owns it.

Format:

```markdown
# {Project Name} — Ideation Conversation

---
turn: 1
role: agent
date: 2026-05-15T12:42:00Z
files_written:
  - ideation/market-research.md (initial sweep)
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

Always the first content file an agent reads after index. Gives full project understanding in one file. Rewritten by each phase on completion — not appended, rewritten.

```markdown
# {Project Name} — Context

## What We're Building
[Validated idea, target audience, core problem solved]
[Written by ideation. Updated by maintain if scope pivots.]

## Tech Stack
[Stack decisions — framework, database, key libraries, hosting]
[Includes WHY — rationale preserved so future agents don't undo intentional choices]
[Written by ideation. Updated by generation if substitutions made.]

## Feature Scope (MVP)
- [ ] Feature A
- [x] Feature B  ← checked off as built
- [ ] Feature C (deferred — see [known-issues.md](known-issues.md))
[Written by ideation. Checked off by generation.]

## Architecture
[Key decisions: data model, auth, API structure, third-party services]
[Written by generation. Updated by maintain if changed.]

## Current State
Phase: {ideation|generation|maintain}
GitHub: {repo URL}
Deployment: {Vercel URL}
Last deploy: {date}

## Known Issues / Tech Debt
{N} open issues — see [known-issues.md](known-issues.md)

## Decision Log
[Append-only. Each phase adds entries. Never delete.]
- [ideation 2026-05-14] Chose Supabase — app needs realtime (see [ideation/tech-stack.md](ideation/tech-stack.md))
- [generation 2026-05-15] Deferred auth to v2 — see [generation/known-issues.md](generation/known-issues.md)
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

## Ideation
- `ideation/tech-stack.md` — stack decisions with rationale | load before writing any code
- `ideation/features.md` — full feature list, MVP vs future | load before implementing
- `ideation/competitors.md` — competitor matrix | load for AEO question generation or positioning decisions
- `ideation/market-research.md` — raw market findings with citations | load for SEO content or positioning

## Generation
- `generation/spec.md` — what was built, arch decisions, deviations from plan | load for incident diagnosis
- `generation/deployment.md` — GitHub repo URL, Vercel URL, env vars | load for deploy operations
- `generation/known-issues.md` — tech debt, deferred features | load for incident correlation

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
phase: ideation
trigger: user approved
files_written:
  - ideation/market-research.md
  - ideation/competitors.md
  - ideation/tech-stack.md
  - ideation/features.md
  - ideation/monetization.md
index_updated: yes
decisions:
  - Chose Supabase over plain Postgres — realtime feature requirement
  - Targeted SMB segment after research showed enterprise market saturated
---

---
date: 2026-05-15
phase: generation
trigger: user approved
files_written:
  - generation/spec.md
  - generation/deployment.md
  - generation/known-issues.md
index_updated: yes
decisions:
  - Deferred auth — out of MVP scope
  - Substituted Vercel Blob for S3 — platform constraint
---
```

## Cross-Linking

Agents write relative markdown links between files when a connection is meaningful. Reader of one file can follow links to related detail without hunting through the index.

```markdown
<!-- in tech-stack.md -->
Chose Supabase over plain Postgres because the app requires realtime subscriptions
(see [ideation/features.md#realtime-feed](ideation/features.md#realtime-feed)).

<!-- in project-context.md decision log -->
- [generation] Deferred auth to v2 — see [generation/known-issues.md](generation/known-issues.md)

<!-- in maintain/incident-2026-05-10.md -->
Root cause correlates with known issue flagged in [generation/known-issues.md#connection-pooling](generation/known-issues.md#connection-pooling).
```

## Prompt Injection Order (every phase)

1. `platform-constraints.md` — internalize hard limits before anything else
2. `index.md` — understand what context exists, decide what to pull
3. `project-context.md` — full project understanding
4. Agent-selected files — whatever the current task requires per the index

## Agent Exit Checklist (every phase)

Before container exits:
1. Append block to `log.md` — always, every run
2. Update `index.md` — register any new files written, update descriptions if files changed
3. Update `project-context.md` — **only if something in it actually changed:**
   - Ideation: always (fills it from scratch)
   - Generation: always (fills deployment URLs, checks off features, adds architecture)
   - Maintain cron (SEO/AEO): only if known issues changed or a deploy happened
   - Maintain incident: only if fix was applied (updates Known Issues, Last deploy, Decision Log)
4. Upload all new/modified files to S3
5. Update Postgres job status → `complete`
