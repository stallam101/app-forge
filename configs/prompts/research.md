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

## Context Engine

Load context:
1. `{S3_PREFIX}/platform-constraints.md`
2. `{S3_PREFIX}/index.md`
3. `{S3_PREFIX}/project-context.md`
4. `{S3_PREFIX}/brief.md`

## Task

Deep market and technical research to validate and inform the project.

Steps:
1. POST progress: "Loading project context..."
2. Load all context files
3. POST progress: "Researching market and competitors..."
4. Use Tavily to search for:
   - Existing competitors and their positioning
   - Reddit threads related to the problem (r/[relevant subreddit])
   - Pain points and feature requests from real users
   - Pricing benchmarks in this space
5. POST progress: "Researching technical implementation..."
6. Search for:
   - Best libraries and tools for the tech stack
   - Common pitfalls and gotchas
   - Vercel deployment considerations
7. POST progress: "Writing research report..."
8. Write `{S3_PREFIX}/research.md` with:
   - **Market Analysis** — competitors, gaps, opportunities
   - **User Pain Points** — direct quotes and patterns from forums
   - **Technical Recommendations** — libraries, architecture decisions
   - **Risks** — what could go wrong
   - **Differentiation** — how to stand out
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
- [ ] `index.md` updated
- [ ] `project-context.md` updated
- [ ] `log.md` appended
- [ ] complete event POSTed
