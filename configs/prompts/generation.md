# Generation Phase — Agent Prompt

## Variables
- PROJECT_ID: {PROJECT_ID}
- S3_PREFIX: {S3_PREFIX}
- JOB_ID: {JOB_ID}
- CALLBACK_URL: {CALLBACK_URL}
- JOB_TOKEN: {JOB_TOKEN}

## Pre-configured Environment Variables (DO NOT request these — they are already set)
- `NVIDIA_API_KEY` — model provider, already configured
- `TAVILY_API_KEY` — web search, already configured
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET_NAME` — S3 access, already configured
- `GITHUB_TOKEN` — GitHub access, already configured
- `VERCEL_TOKEN` — Vercel CLI access, already configured

Do NOT post CREDENTIAL_REQUEST for any of the above. They are pre-injected into this container.

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
5. `{S3_PREFIX}/research.md`

## Task

Build and deploy the application.

Steps:
1. POST progress: "Loading full project context..."
2. Load all context files
3. POST progress: "Creating GitHub repository..."
4. Use GitHub MCP to create a new repo named after the project
5. POST progress: "Scaffolding Next.js application..."
6. Use bash to scaffold the app:
   ```bash
   npx create-next-app@latest /workspace/app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
   cd /workspace/app
   ```
7. POST progress: "Implementing core features..."
8. Implement the features listed in brief.md — use GitHub MCP to push commits
9. POST progress: "Setting up Vercel deployment..."
10. Use bash MCP to create project and deploy:
    ```bash
    cd /workspace/app
    vercel project add appforge-{slug} --token $VERCEL_TOKEN
    vercel link --yes --token $VERCEL_TOKEN --project appforge-{slug}
    vercel deploy --prod --token $VERCEL_TOKEN
    ```
11. POST progress: "Running tests..."
12. Run any tests, fix failures
13. Write `{S3_PREFIX}/generation.md` with:
    - GitHub repo URL
    - Vercel deployment URL
    - Architecture decisions made
    - Known limitations
14. Update `{S3_PREFIX}/project-context.md` with repo and deployment URLs
15. Update `{S3_PREFIX}/index.md`
16. Append to `{S3_PREFIX}/log.md`: `GENERATION complete — {timestamp}`
17. POST complete

## Approval Protocol

If a significant architectural decision requires user sign-off:
```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"approval_request","message":"<describe what needs approval>","metadata":{"type":"PHASE_TRANSITION"}}'
```
Wait for approval before continuing.

## Blocker Protocol

```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"blocker","message":"<describe blocker>"}'
```

## Exit Checklist
- [ ] GitHub repo created and code pushed
- [ ] Vercel deployment live
- [ ] `generation.md` written
- [ ] `project-context.md` updated with URLs
- [ ] `log.md` appended
- [ ] complete event POSTed
