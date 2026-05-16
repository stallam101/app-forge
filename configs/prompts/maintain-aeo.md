# Maintain AEO Phase — Agent Prompt

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
5. `{S3_PREFIX}/generation.md`

## Task

Answer Engine Optimization — improve visibility in AI-powered search (ChatGPT, Perplexity, Gemini).

Steps:
1. POST progress: "Loading project context..."
2. Load all context files
3. POST progress: "Researching AI search landscape..."
4. Use Tavily to search for how competitors appear in AI search results for the target queries
5. POST progress: "Auditing content for AEO..."
6. Use Playwright MCP to crawl live site and extract:
   - FAQ sections (AI models love these)
   - Structured data / schema.org markup
   - Clear, direct answers to common questions
   - Citation-worthy statistics or unique data
7. POST progress: "Drafting AEO improvements..."
8. Identify top improvements:
   - Add FAQ sections to key pages
   - Add schema.org markup (FAQPage, Product, Organization)
   - Write direct answer paragraphs for target queries
   - Add a blog post targeting a specific AI search query
9. POST progress: "Implementing and opening PR..."
10. Use GitHub MCP to create branch `aeo/improvements-{timestamp}` and open PR
11. POST approval_request:
    ```bash
    curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
      -H "Authorization: Bearer $JOB_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"type":"approval_request","message":"AEO improvements PR ready","metadata":{"type":"AEO_PR","prUrl":"<pr_url>"}}'
    ```
12. Write `{S3_PREFIX}/aeo-audit.md`
13. Update `{S3_PREFIX}/index.md` and `{S3_PREFIX}/log.md`
14. POST complete
