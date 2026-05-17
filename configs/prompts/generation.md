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

Use bash to POST progress events throughout your work:

```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"progress","message":"<your message here>"}'
```

## Tool Call Logging

Before EVERY tool call, POST a tool_use event via bash:

```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"tool_use","message":"[tool_name] <brief description>"}'
```

Examples:
- `[s3_get_object] Reading index.md`
- `[s3_get_object] Reading brief.md`
- `[s3_put_object] Writing generation.md`
- `[bash] Creating GitHub repository`
- `[bash] Scaffolding Next.js app`
- `[bash] Deploying to Vercel`

## Steps

**Do these in order. Do not skip any step.**

### Step 1 — Signal start immediately
Run this bash command RIGHT NOW before doing anything else:
```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"progress","message":"Generation agent started"}'
```

### Step 2 — Load context
POST tool_use then read each file via `s3_get_object`:
- `{S3_PREFIX}/index.md` — source of truth, read this first
- `{S3_PREFIX}/platform-constraints.md`
- `{S3_PREFIX}/project-context.md`
- `{S3_PREFIX}/brief.md`
- `{S3_PREFIX}/research.md`

Then POST: `"Loaded project context"`

### Step 3 — Create GitHub repository
POST: `"Creating GitHub repository..."`

```bash
curl -s -X POST https://api.github.com/user/repos \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"<slug-from-brief>","private":false,"auto_init":true}'
```

POST: `"GitHub repo created: <repo-url>"`

### Step 4 — Scaffold Next.js app
POST: `"Scaffolding Next.js application..."`

```bash
npx create-next-app@latest /workspace/app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
cd /workspace/app
git init
git remote add origin https://$GITHUB_TOKEN@github.com/<username>/<repo-name>.git
```

POST: `"Next.js scaffolded"`

### Step 5 — Implement features
POST: `"Implementing features from brief..."`

Implement the features described in brief.md. Write files in `/workspace/app`, commit and push:
```bash
cd /workspace/app
git add -A
git commit -m "feat: initial implementation"
git push -u origin main
```

POST: `"Code pushed to GitHub"`

### Step 6 — Deploy to Vercel
POST: `"Deploying to Vercel..."`

```bash
cd /workspace/app
npx vercel@latest link --yes --token $VERCEL_TOKEN
npx vercel@latest deploy --prod --token $VERCEL_TOKEN
```

POST: `"Deployed to Vercel: <deployment-url>"`

### Step 7 — Write generation report
POST: `"Writing generation report..."`

Write `{S3_PREFIX}/generation.md` via `s3_put_object` with:
- GitHub repo URL
- Vercel deployment URL
- Architecture decisions
- Known limitations

Update `{S3_PREFIX}/project-context.md` with URLs.
Update `{S3_PREFIX}/index.md`.
Append to `{S3_PREFIX}/log.md`: `GENERATION complete — <timestamp>`

### Step 8 — Done
```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"complete","message":"Generation complete"}'
```

## Blocker Protocol

If you hit a hard blocker:
```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"blocker","message":"<describe blocker clearly>"}'
```

## Exit Checklist
- [ ] Step 1 progress event posted immediately
- [ ] All context files loaded via s3_get_object
- [ ] GitHub repo created and code pushed
- [ ] Vercel deployment live
- [ ] `generation.md` written with repo URL and deployment URL
- [ ] `project-context.md` and `index.md` updated
- [ ] `log.md` appended
- [ ] complete event POSTed
