# AppForge — Phase: Research

> **Hackathon Scope (1h):** REAL — the qualifying phase. OpenClaw + Nemotron 3 Super 120B on Brev.dev with web_search (Tavily) + file_write + fetch tools. The whole prize bet is on this working live on stage. See `hackathon-implementation-plan.md`.

## Purpose

Take the product direction from ticket creation and go deep. Full autonomous market research, competitive analysis, tech stack validation, feature list, and monetization model. Research is the evidence layer — ticket creation gave direction, Research gives confidence.

## Context Engine — What Agent Loads

**Always loaded:**
- `platform-constraints.md` — tech recommendations must stay within hosting limits
- `index.md` — catalog of all context files
- `project-context.md` — What We're Building (seeded by ticket creation)

**Agent pulls on demand:**
- `ideation/product-direction.md` — confirmed niche, target audience, problem statement, constraints
- `ideation/conversation.md` — full ideation chat if deeper intent context is needed
- Any other ideation files written during conversation turns

## Execution Flow

```
1. Load Context Engine core files
2. Pull ideation/product-direction.md — north star for all research
3. Run full Reddit sweep — subreddits relevant to the niche, pain points, sentiment
4. Run X sweep — trending discussions, founder threads, user complaints
5. Web research — competitor sites, ProductHunt launches, App Store reviews, market reports
6. Build competitor matrix — name, strengths, weaknesses, moat, pricing
7. Market sizing — TAM/SAM/SOM if determinable
8. Validate or challenge initial feature hypotheses from product-direction.md
9. Produce prioritized MVP feature list
10. Recommend tech stack with rationale (cross-check against platform-constraints.md)
11. Recommend monetization model with evidence
12. Run Context Engine exit checklist
```

## Outputs

Agent decides what files to create. All registered in `index.md`. Typical research outputs:

```
research/
  market-analysis.md    ← market size, trends, opportunity assessment with citations
  competitors.md        ← competitor matrix (name, strengths, weaknesses, moat, pricing)
  reddit-findings.md    ← raw Reddit pain points + sentiment with source links
  x-findings.md         ← X/Twitter discussions + founder threads with source links
  features.md           ← prioritized MVP feature list (validated against market findings)
  tech-stack.md         ← recommended stack with WHY rationale, cross-linked to features.md
  monetization.md       ← monetization model options + recommended model with evidence
```

Additional files as needed (e.g. `research/regulatory.md` for a fintech app). Agent decides.

## Context Engine — Exit Checklist

Before container exits:
1. Append run block to `log.md`
2. Update `index.md` — register all new research files with description + when-to-read
3. Rewrite `project-context.md`:
   - Fill Tech Stack section (with WHY from research/tech-stack.md)
   - Fill Feature Scope checklist from research/features.md
   - Add Decision Log entries for key research conclusions
4. Upload all new/modified files to S3
5. Update Postgres job status → `complete`

## Completion

Card moves to `awaiting approval`. User reviews research artifacts (linked from kanban card). User approves → project queues for Generation.

## Blocker Scenarios

| Blocker | Required input |
|---------|---------------|
| Reddit API missing | `REDDIT_API_KEY` |
| X API missing | `X_API_KEY` |
| Product direction too vague to research meaningfully | User decision — clarify or abort |

## Prompt Template Skeleton

```
You are an expert market researcher and product strategist operating within the AppForge Context Engine.

## Context Engine Instructions
1. Read platform-constraints.md first — all tech recommendations must comply
2. Read index.md — understand what context exists
3. Read project-context.md — What We're Building
4. Pull ideation/product-direction.md — your north star for all research
5. Pull ideation/conversation.md if you need deeper context on the user's intent
6. Before exiting: append to log.md, update index.md, rewrite project-context.md with Tech Stack + Feature Scope

## Your Task
Research and validate the product described in ideation/product-direction.md.
Go deep — Reddit, X, competitors, market size, product-market fit signals.
Validate or challenge the feature hypotheses from product-direction.md.
Recommend tech stack within platform constraints. Recommend monetization model.
Write whatever files are useful. Cross-link related files. Cite all claims.
```
