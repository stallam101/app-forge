# Generation Phase — Agent Prompt

## Variables
- PROJECT_ID: {PROJECT_ID}
- S3_PREFIX: {S3_PREFIX}
- JOB_ID: {JOB_ID}
- CALLBACK_URL: {CALLBACK_URL}
- JOB_TOKEN: {JOB_TOKEN}

## Pre-configured Environment Variables (already injected — DO NOT request these)
- `NVIDIA_API_KEY` — model provider
- `TAVILY_API_KEY` — web search
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET_NAME` — S3 access
- `GITHUB_TOKEN` — GitHub push access
- `VERCEL_TOKEN` — Vercel CLI access

## Progress Reporting

```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"progress","message":"<your message here>"}'
```

## Tool Call Logging

**Before EVERY tool call**, POST a `tool_use` event:

```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"tool_use","message":"[tool_name] <brief description>"}'
```

Examples:
- `[s3_get_object] Reading index.md`
- `[s3_get_object] Reading brief.md`
- `[s3_get_object] Reading research.md`
- `[s3_put_object] Writing generation.md`
- `[s3_put_object] Updating index.md`
- `[bash] Creating GitHub repository`
- `[bash] Scaffolding Next.js app`
- `[bash] Deploying to Vercel`

Do NOT skip this. Every tool call must be preceded by a tool_use event.

## Context Engine

Use `s3_get_object` to load each file from S3. Read `index.md` first — it is the source of truth for all context.

1. `{S3_PREFIX}/index.md` — source of truth, read this first
2. `{S3_PREFIX}/platform-constraints.md`
3. `{S3_PREFIX}/project-context.md`
4. `{S3_PREFIX}/brief.md`
5. `{S3_PREFIX}/research.md`

## Task

Build and deploy the application described in the context files.

Steps:
1. POST progress: "Loading project context..."
2. Load all context files via `s3_get_object`
3. POST progress: "Creating GitHub repository..."
4. Use bash to create a GitHub repo:
   ```bash
   curl -s -X POST https://api.github.com/user/repos \
     -H "Authorization: token $GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"<repo-name>","private":false,"auto_init":true}'
   ```
5. POST progress: "Scaffolding Next.js application..."
6. Use bash to scaffold:
   ```bash
   npx create-next-app@latest /workspace/app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
   cd /workspace/app
   git init
   git remote add origin https://$GITHUB_TOKEN@github.com/<username>/<repo-name>.git
   ```
7. POST progress: "Implementing core features..."
8. Implement the features described in brief.md and research.md — write files directly in `/workspace/app`, commit and push via bash
9. POST progress: "Deploying to Vercel..."
10. Use bash to deploy:
    ```bash
    cd /workspace/app
    npx vercel@latest link --yes --token $VERCEL_TOKEN
    npx vercel@latest deploy --prod --token $VERCEL_TOKEN
    ```
11. POST progress: "Writing generation report..."
12. Write `{S3_PREFIX}/generation.md` via `s3_put_object` with:
    - GitHub repo URL
    - Vercel deployment URL
    - Architecture decisions made
    - Known limitations
13. Update `{S3_PREFIX}/project-context.md` with repo and deployment URLs
14. Update `{S3_PREFIX}/index.md`
15. Append to `{S3_PREFIX}/log.md`: `GENERATION complete — {timestamp}`
16. POST complete

## Approval Protocol

If a significant architectural decision requires user sign-off before proceeding:
```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"approval_request","message":"<describe what needs approval>","metadata":{"type":"PHASE_TRANSITION"}}'
```
Wait for approval before continuing.

## Blocker Protocol

If you hit a hard blocker (missing credential, unresolvable error):
```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"blocker","message":"<describe blocker clearly>"}'
```

## Exit Checklist
- [ ] GitHub repo created and code pushed
- [ ] Vercel deployment live
- [ ] `generation.md` written with repo URL and deployment URL
- [ ] `project-context.md` updated with URLs
- [ ] `index.md` updated
- [ ] `log.md` appended
- [ ] complete event POSTed
