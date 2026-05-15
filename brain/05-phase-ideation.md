# AppForge — Phase: Ideation

## Purpose

Transform a user's brief (as vague as one sentence) into a structured product document: validated market opportunity, target audience, competitors, monetization model, feature list, and recommended tech stack — all constrained to what the target hosting platform supports.

## Context Engine — What Agent Loads

**Always loaded by AppForge before agent starts:**
- `platform-constraints.md` — hosting limits, load before planning anything
- `index.md` — what context files exist (stub at this phase — only seeded files)
- `project-context.md` — stub at this phase, contains only the original brief

**Agent pulls on demand:**
- `brief.md` — if original intent needs clarification beyond project-context.md

## Adaptive Research Depth

Agent reads the brief and scores its specificity:
- **Vague** (e.g. "I want a fintech app") → broad market sweep: Reddit trends, X posts, competitor landscape, market size, existing solutions with moat analysis
- **Specific** (e.g. "A budgeting app for freelancers that tracks invoice payment delays") → gap-filling only: validate assumptions, find competitors, identify differentiation angles, confirm market exists

The agent decides research depth internally — no user input needed.

## Research Sources

Agent uses OpenClaw's web search + API tools to pull:
- Reddit: search relevant subreddits for pain points, existing solutions, user sentiment
- X: search for trending discussions, founder threads, user complaints in the space
- General web: competitor sites, ProductHunt launches, App Store reviews, market reports

All sources cited in output documents.

## Outputs

Agent decides what files to create based on what's useful for the project. All files registered in `index.md` with description + when-to-read hint. Typical ideation outputs:

```
ideation/
  research.md          ← raw research findings with citations
  market-analysis.md   ← market size, trends, opportunity assessment
  competitors.md       ← competitor matrix (name, strengths, weaknesses, moat)
  product-brief.md     ← target audience, problem statement, proposed solution
  features.md          ← prioritized feature list (MVP vs. future)
  tech-stack.md        ← recommended stack with rationale (WHY, not just what)
  monetization.md      ← monetization model options with rationale
```

Additional files created if the project warrants it (e.g. `compliance/gdpr.md` for a fintech app). Agent decides.

## Context Engine — Exit Checklist

Before container exits:
1. Append run block to `log.md`
2. Update `index.md` — register all new files with description + when-to-read
3. Rewrite `project-context.md` — fills What We're Building, Tech Stack (with WHY), Feature Scope checklist, Decision Log entries
4. Upload all new/modified files to S3
5. Update Postgres job status → `complete`

## Completion

Card moves to `awaiting approval`. User reviews ideation artifacts (linked from kanban card). User approves → project queues for Generation.

## Blocker Scenarios

| Blocker | Required input |
|---------|---------------|
| Reddit API missing key | `REDDIT_API_KEY` |
| X API missing key | `X_API_KEY` |
| Brief too ambiguous to proceed | User decision — agent asks clarifying question |

## Prompt Template Skeleton

```
You are an expert product researcher and market analyst operating within the AppForge Context Engine.

## Context Engine Instructions
1. Read platform-constraints.md first — never plan anything outside these limits
2. Read index.md — understand what context exists
3. Read project-context.md — understand the project brief
4. Pull additional files from S3 as needed via the index
5. Before exiting: append to log.md, update index.md with all new files, rewrite project-context.md

## Your Task
Research and validate the product idea in project-context.md.
Adapt research depth to brief specificity — vague = broad sweep, specific = gap-fill only.
Write whatever files are useful. Register all of them in index.md.
Cross-link related files using relative markdown paths.
Cite all claims. Include URLs for all sources.

## Platform Constraints
Read platform-constraints.md. All tech recommendations must stay within these limits.
```
