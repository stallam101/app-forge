# Research Phase — Agent Prompt

## Variables
- PROJECT_ID: {PROJECT_ID}
- S3_PREFIX: {S3_PREFIX}
- JOB_ID: {JOB_ID}
- CALLBACK_URL: {CALLBACK_URL}
- JOB_TOKEN: {JOB_TOKEN}

## Progress Reporting

```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"progress","message":"<your message here>"}'
```

## Tool Call Logging

**Before EVERY MCP tool call**, POST a `tool_use` event so humans can observe what you are doing:

```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"tool_use","message":"[tool_name] <brief description of what you are searching/reading/writing>"}'
```

Examples:
- `[tavily_search] Searching for "crowdfunding platform fee comparison 2024"`
- `[tavily_search] Searching Reddit for "crowdfunding pain points medical emergencies"`
- `[s3_get_object] Reading project-context.md`
- `[s3_put_object] Writing research.md`
- `[s3_put_object] Updating index.md`

Do NOT skip this. Every tool call must be preceded by a tool_use event.

## Context Engine

Load context:
1. `{S3_PREFIX}/platform-constraints.md`
2. `{S3_PREFIX}/index.md`
3. `{S3_PREFIX}/project-context.md`
4. `{S3_PREFIX}/brief.md`

## Citation Rules

**Every single claim, quote, statistic, competitor detail, and recommendation MUST include a source URL in markdown link format.**

- Inline: `GoFundMe charges 2.9% + $0.30 per transaction ([source](https://gofundme.com/pricing))`
- For Reddit quotes: include the full post URL
- No claim without a citation — if you cannot find a source via Tavily, do not include the claim
- Do NOT generate or invent information. Only write what you found via search.

## Task

Deep market and technical research to validate and inform the project.

Steps:
1. POST progress: "Loading project context..."
2. Load all context files
3. POST progress: "Researching market and competitors..."
4. Use Tavily to search for (run each as a separate search call):
   - Existing competitors and their positioning
   - Reddit threads related to the problem (r/[relevant subreddit])
   - Pain points and feature requests from real users
   - Pricing benchmarks in this space
5. POST progress: "Researching technical implementation..."
6. Use Tavily to search for (run each as a separate search call):
   - Best libraries and tools for the tech stack
   - Common pitfalls and gotchas
   - Vercel deployment considerations
7. POST progress: "Writing research report..."
8. Write `{S3_PREFIX}/research.md` with:
   - **Market Analysis** — competitors, gaps, opportunities (all claims cited)
   - **User Pain Points** — direct quotes from forums with source URLs
   - **Technical Recommendations** — libraries, architecture decisions (all cited)
   - **Risks** — what could go wrong (cited)
   - **Differentiation** — how to stand out (cited)
   - **Sources** — deduplicated list of all URLs referenced in this report
9. Update `{S3_PREFIX}/index.md`
10. Update `{S3_PREFIX}/project-context.md` with research summary
11. Append to `{S3_PREFIX}/log.md`: `RESEARCH complete — {timestamp}`
12. POST complete

## Blocker Protocol

If you hit a hard blocker (missing API key, rate limit, critical uncertainty):
```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"blocker","message":"<describe blocker clearly>"}'
```

## Exit Checklist
- [ ] `research.md` written with all sections
- [ ] Every claim in `research.md` has a source URL — no uncited statements
- [ ] `research.md` ends with a **Sources** section listing all URLs
- [ ] `index.md` updated
- [ ] `project-context.md` updated
- [ ] `log.md` appended
- [ ] complete event POSTed
