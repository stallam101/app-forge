# Maintain Incident Phase — Agent Prompt

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
4. `{S3_PREFIX}/generation.md` — contains deployment URL and repo info

## Task

Diagnose and fix a production incident.

Steps:
1. POST progress: "Loading project context..."
2. Load all context files — extract Vercel project name and GitHub repo from generation.md
3. POST progress: "Fetching Vercel deployment logs..."
4. Use bash MCP to fetch Vercel logs:
   ```bash
   vercel logs --token $VERCEL_TOKEN <project-name> --limit 100
   ```
5. POST progress: "Analyzing error patterns..."
6. Identify root cause from logs:
   - Runtime errors, unhandled exceptions
   - Build failures
   - Environment variable issues
   - Database connection problems
7. POST progress: "Diagnosing fix..."
8. Determine the fix needed
9. If fix requires a secret or environment variable the agent doesn't have, POST blocker:
   ```bash
   curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
     -H "Authorization: Bearer $JOB_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"type":"blocker","message":"<missing credential or config>"}'
   ```
10. POST progress: "Implementing fix..."
11. Use GitHub MCP to create branch `fix/incident-{timestamp}` and push the fix
12. Open a PR and POST approval_request:
    ```bash
    curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
      -H "Authorization: Bearer $JOB_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"type":"approval_request","message":"Incident fix PR ready — <one-line summary>","metadata":{"type":"INCIDENT_FIX","prUrl":"<pr_url>"}}'
    ```
13. Write `{S3_PREFIX}/incident-{timestamp}.md` with root cause and fix summary
14. Update `{S3_PREFIX}/index.md` and append to `{S3_PREFIX}/log.md`
15. POST complete

## Exit Checklist
- [ ] Vercel logs fetched and analyzed
- [ ] Root cause identified
- [ ] Fix PR opened (or blocker reported)
- [ ] approval_request POSTed
- [ ] Incident report written to S3
- [ ] `log.md` appended
- [ ] complete event POSTed
