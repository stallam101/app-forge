# AppForge — Architecture

## Infrastructure Overview

```
┌─────────────────────────────────────────────────────┐
│                    AWS                               │
│                                                      │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │  Next.js App │     │      ECS Fargate          │  │
│  │  (App Runner │────▶│  Phase containers         │  │
│  │   or EC2)    │     │  (on-demand, per task)    │  │
│  └──────┬───────┘     └──────────────────────────┘  │
│         │                                            │
│  ┌──────▼───────┐     ┌──────────────────────────┐  │
│  │  RDS Postgres│     │          S3               │  │
│  │  (metadata,  │     │  (project context MD      │  │
│  │   secrets,   │     │   files, artifacts)       │  │
│  │   job queue) │     └──────────────────────────┘  │
│  └──────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

## Components

### Next.js App (frontend + API)
- Serves kanban UI, approvals page, settings page
- API routes handle: project CRUD, job queue management, SSE streams, webhook ingestion
- Runs on AWS App Runner or EC2 (always-on, not serverless — needs SSE connections)

### BullMQ (job queue)
- One queue per phase: `ideation-queue`, `generation-queue`, `maintain-queue`
- Workers run inside the Next.js app process
- On job pickup: trigger ECS Fargate task, pass job ID + project ID
- Job states map directly to kanban card badge states

### ECS Fargate (agent runtime)
- One task definition per phase (ideation, generation, maintain)
- Spun up on-demand by BullMQ worker when job is dequeued
- Container receives: project ID, job ID, phase, env vars (secrets)
- Container pulls project context from S3 on start
- Container runs OpenClaw CLI for the phase task
- Container writes artifacts back to S3, updates Postgres job status, exits

### RDS Postgres (metadata store)
- Projects: id, name, description, current_phase, created_at
- Phase jobs: id, project_id, phase, status, blocker_reason, created_at, completed_at
- Artifacts index: id, project_id, phase, s3_key, created_at (S3 is source of truth, Postgres holds keys)
- Secrets: id, key_name, encrypted_value (AES-256)
- Approval requests: id, project_id, phase, reason, citations, pr_url, status, created_at

### S3 (context + artifact store)
Structure:
```
projects/
  {project-id}/
    context/
      brief.md          ← user's original input
      platform-constraints.md  ← injected at task start
      ideation/
        research.md
        market-analysis.md
        tech-stack.md
      generation/
        spec.md
        test-report.md
      maintain/
        seo-audit-{date}.md
        incident-{id}.md
```

All files pulled to container at task start. All new/updated files pushed back on task complete.

## Queue Behavior

- Each phase queue: one active runner at a time
- Multiple phases can run simultaneously (Project A in ideation while Project B in generation)
- Blocked jobs stay in queue as `blocked` — do not dequeue until user resolves blocker
- Failed jobs: logged, card shows `failed`, manual retry

## Secrets Flow

1. User enters secret in settings UI
2. API route encrypts with AES-256, stores in Postgres
3. On ECS task spin-up: BullMQ worker decrypts, injects as env vars into task definition
4. Secret never written to S3 or logs

## External Integrations

| Service | Purpose | Auth method |
|---------|---------|-------------|
| GitHub API | Create repos, push commits, open PRs | Personal access token (user-provided) |
| Vercel | Auto-deploy via GitHub integration | GitHub integration (no separate token needed) |
| Reddit API | Ideation research | API key (user-provided) |
| X API | Ideation research | API key (user-provided) |
| PagerDuty | Prod incident webhooks → maintain agent | Webhook secret (user-provided) |
