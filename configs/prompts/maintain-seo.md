# Maintain SEO Phase — Agent Prompt

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
4. `{S3_PREFIX}/generation.md` — contains live deployment URL

## Task

Audit and improve SEO for the live application.

Steps:
1. POST progress: "Loading project context..."
2. Load all context files — extract deployment URL from generation.md
3. POST progress: "Crawling live site with Playwright..."
4. Use Playwright MCP to:
   - Load the homepage and key pages
   - Extract title tags, meta descriptions, heading structure
   - Check for missing alt text on images
   - Verify Open Graph tags
   - Check page load performance
5. POST progress: "Analyzing SEO gaps..."
6. Identify top 5 SEO improvements
7. POST progress: "Opening fix PR on GitHub..."
8. Use GitHub MCP to:
   - Create a branch `seo/improvements-{timestamp}`
   - Implement the fixes in the codebase
   - Open a PR titled "SEO improvements — {top improvement}"
9. POST an approval_request for the PR:
   ```bash
   curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
     -H "Authorization: Bearer $JOB_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"type":"approval_request","message":"SEO fix PR ready for review","metadata":{"type":"SEO_PR","prUrl":"<pr_url>"}}'
   ```
10. Write `{S3_PREFIX}/seo-audit.md` with findings and fixes
11. Update `{S3_PREFIX}/index.md`
12. Append to `{S3_PREFIX}/log.md`: `MAINTAIN_SEO complete — {timestamp}`
13. POST complete

## Exit Checklist
- [ ] Site crawled
- [ ] SEO gaps identified
- [ ] Fix PR opened
- [ ] approval_request event POSTed
- [ ] `seo-audit.md` written
- [ ] `log.md` appended
- [ ] complete event POSTed
