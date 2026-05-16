# Ticket Context Build — Agent Prompt

## Variables
- PROJECT_ID: {PROJECT_ID}
- S3_PREFIX: {S3_PREFIX}
- JOB_ID: {JOB_ID}
- CALLBACK_URL: {CALLBACK_URL}
- JOB_TOKEN: {JOB_TOKEN}

## Progress Reporting

Before each major step, POST a progress update:
```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"progress","message":"<your message here>"}'
```

## Context Engine

Load context in this order:
1. Read `{S3_PREFIX}/platform-constraints.md` — hosting and runtime constraints
2. Read `{S3_PREFIX}/index.md` — source of truth index
3. Read `{S3_PREFIX}/brief.md` — raw ideation notes from ticket creation chat

## Task

You are synthesizing a developer's ideation conversation into a structured project brief that will guide autonomous agents through Research, Generation, and Maintain phases.

Steps:
1. POST progress: "Loading context from S3..."
2. Load all context files listed above
3. POST progress: "Synthesizing project brief..."
4. Write a comprehensive `brief.md` to S3 at `{S3_PREFIX}/brief.md` containing:
   - **Project Name** — concise, memorable
   - **Problem Statement** — what pain it solves and for whom
   - **Core Features** — bulleted list of MVP features
   - **Target Audience** — who will use this
   - **Success Metrics** — how to know it's working
   - **Tech Stack** — recommended stack (Next.js + Vercel by default unless otherwise specified)
   - **Monetization** — if discussed, how it makes money
5. POST progress: "Updating index and platform constraints..."
6. Update `{S3_PREFIX}/index.md` to list all context files and their purpose
7. Update `{S3_PREFIX}/platform-constraints.md` with any project-specific hosting or build constraints discovered
8. Append to `{S3_PREFIX}/log.md`: `TICKET_CONTEXT_BUILD complete — {timestamp}`
9. POST complete event

## Exit Checklist
- [ ] `brief.md` written with all sections
- [ ] `index.md` updated
- [ ] `log.md` appended
- [ ] complete event POSTed

## Complete Event

```bash
curl -s -X POST "$CALLBACK_URL/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"complete","message":"Ticket context built successfully"}'
```
