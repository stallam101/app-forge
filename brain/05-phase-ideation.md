# AppForge — Phase: Ideation

## Purpose

Transform a user's brief (as vague as one sentence) into a structured product document: validated market opportunity, target audience, competitors, monetization model, feature list, and recommended tech stack — all constrained to what the target hosting platform supports.

## Inputs

Pulled from S3 at container start:
- `context/brief.md` — user's original input (required)
- `context/platform-constraints.md` — injected at task start (always present)
- Any additional context files the user attached at project creation

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

## Outputs (written to S3)

```
context/ideation/
  research.md          ← raw research findings with citations
  market-analysis.md   ← market size, trends, opportunity assessment
  competitors.md       ← competitor matrix (name, strengths, weaknesses, moat)
  product-brief.md     ← target audience, problem statement, proposed solution
  features.md          ← prioritized feature list (MVP vs. future)
  tech-stack.md        ← recommended stack (constrained to platform)
  monetization.md      ← monetization model options with rationale
```

## Completion

Agent writes all output files, updates job status to `complete`, exits 0.

Card moves to `awaiting approval`. User reviews ideation artifacts (linked directly from kanban card). User approves → project queues for Generation.

## Blocker Scenarios

| Blocker | Required input |
|---------|---------------|
| Reddit API rate limited or missing key | `REDDIT_API_KEY` |
| X API missing key | `X_API_KEY` |
| Brief too ambiguous to proceed even with research | User decision — agent asks clarifying question |

## Prompt Template Skeleton

```
You are an expert product researcher and market analyst.

## Your Task
Research and validate the following product idea. Produce structured documents as specified.

## User Brief
{brief}

## Platform Constraints
{platform-constraints}

## Research Depth
{vague|specific} — {reason based on brief analysis}

## Required Outputs
Produce the following files in /tmp/output/:
- research.md
- market-analysis.md
- competitors.md
- product-brief.md
- features.md
- tech-stack.md
- monetization.md

Cite all claims. Include URLs for all sources.
```
