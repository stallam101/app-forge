# AppForge — Maintain Phase: Implementation Spec

This doc is the code blueprint. When implementing maintain, follow this exactly.

## API Routes

### `/api/cron/maintain/route.ts` — Daily Cron

```typescript
// Vercel Cron config in vercel.json: { "path": "/api/cron/maintain", "schedule": "0 9 * * *" }

export async function GET(req: Request) {
  // 1. Verify cron secret (Vercel injects CRON_SECRET header)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Find all projects in MAINTAIN status
  const projects = await db.project.findMany({
    where: { status: 'MAINTAIN' },
  })

  // 3. Create jobs for each project
  // Bundle size ON HOLD — not in active daily workflows
  const workflows: JobPhase[] = ['MAINTAIN_SEO', 'MAINTAIN_AEO', 'MAINTAIN_CONTENT_FRESHNESS']

  for (const project of projects) {
    for (const phase of workflows) {
      // Skip if a RUNNING or QUEUED job already exists for this project+phase
      const existing = await db.job.findFirst({
        where: { projectId: project.id, phase, status: { in: ['QUEUED', 'RUNNING'] } },
      })
      if (existing) continue

      await db.job.create({
        data: {
          projectId: project.id,
          phase,
          status: 'QUEUED',
          jobToken: createId(), // CUID
        },
      })
    }
  }

  return Response.json({ queued: projects.length * workflows.length })
}
```

### `/api/cron/maintain/competitor/route.ts` — Weekly Cron

Same pattern as daily but only creates `MAINTAIN_COMPETITOR` jobs.

### `/api/webhooks/pagerduty/route.ts` — Incident Webhook

```typescript
export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('x-pagerduty-signature')

  // 1. Verify HMAC-SHA256 signature
  const secret = await getDecryptedSetting('PAGERDUTY_WEBHOOK_SECRET')
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  if (signature !== `v1=${expected}`) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 2. Parse payload
  const payload = JSON.parse(body)
  const incident = payload.event.data

  // 3. Map service to project (by service name convention or setting)
  const project = await db.project.findFirst({
    where: { name: { contains: incident.service.name, mode: 'insensitive' } },
  })
  if (!project) {
    return Response.json({ error: 'No matching project' }, { status: 404 })
  }

  // 4. Create PRIORITY incident job
  const job = await db.job.create({
    data: {
      projectId: project.id,
      phase: 'MAINTAIN_INCIDENT',
      status: 'QUEUED',
      jobToken: createId(),
      metadata: { priority: true, incidentPayload: incident },
    },
  })

  // 5. Launch ECS task IMMEDIATELY (skip queue poller)
  await launchECSTask(job.id)

  return Response.json({ jobId: job.id })
}
```

### `/api/projects/[id]/maintain/trigger/route.ts` — Manual Trigger (hackathon)

```typescript
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { workflow } = await req.json() // 'SEO' | 'AEO' | 'BUNDLE' | 'CONTENT_FRESHNESS' | 'COMPETITOR'
  const phase = `MAINTAIN_${workflow}` as JobPhase

  const job = await db.job.create({
    data: {
      projectId: params.id,
      phase,
      status: 'QUEUED',
      jobToken: createId(),
    },
  })

  // For hackathon: launch immediately (no queue poller)
  await launchECSTask(job.id)

  return Response.json({ jobId: job.id })
}
```

## Auto-Merge Engine

### `/src/lib/auto-merge.ts`

```typescript
import { Octokit } from '@octokit/rest'
import { minimatch } from 'minimatch'

const AUTO_MERGE_CONFIG = {
  allowedFilePatterns: [
    '**/metadata.ts',
    '**/sitemap.ts',
    '**/robots.ts',
    '**/opengraph-image.*',
    '**/schema.tsx',
    '**/faq/**',
    '**/blog/**',
    'public/sitemap.xml',
    'public/robots.txt',
    'package.json',
    'package-lock.json',
  ],
  blockedFilePatterns: [
    '**/route.ts',
    '**/middleware.ts',
    '**/layout.tsx',
    '**/*.test.*',
    'prisma/**',
    '.env*',
  ],
  maxFilesChanged: 5,
  requireCIPass: true,
  neverAutoMerge: ['MAINTAIN_INCIDENT', 'MAINTAIN_BUNDLE'] as string[],
}

type AutoMergeResult = {
  eligible: boolean
  reason: string
}

export async function evaluateAutoMerge(
  prUrl: string,
  jobPhase: string,
  githubToken: string
): Promise<AutoMergeResult> {
  // 1. Check job type blacklist
  if (AUTO_MERGE_CONFIG.neverAutoMerge.includes(jobPhase)) {
    return { eligible: false, reason: `${jobPhase} never auto-merges` }
  }

  const octokit = new Octokit({ auth: githubToken })
  const { owner, repo, pull_number } = parsePrUrl(prUrl)

  // 2. Get PR files
  const { data: files } = await octokit.pulls.listFiles({ owner, repo, pull_number })

  // 3. Check file count
  if (files.length > AUTO_MERGE_CONFIG.maxFilesChanged) {
    return { eligible: false, reason: `${files.length} files changed (max ${AUTO_MERGE_CONFIG.maxFilesChanged})` }
  }

  // 4. Check blocked patterns
  for (const file of files) {
    for (const pattern of AUTO_MERGE_CONFIG.blockedFilePatterns) {
      if (minimatch(file.filename, pattern)) {
        return { eligible: false, reason: `${file.filename} matches blocked pattern ${pattern}` }
      }
    }
  }

  // 5. Check all files match allowed patterns
  for (const file of files) {
    const matchesAllowed = AUTO_MERGE_CONFIG.allowedFilePatterns.some(p => minimatch(file.filename, p))
    if (!matchesAllowed) {
      return { eligible: false, reason: `${file.filename} not in allowed patterns` }
    }
  }

  // 6. Check CI status (if required)
  if (AUTO_MERGE_CONFIG.requireCIPass) {
    const { data: checks } = await octokit.checks.listForRef({
      owner, repo, ref: `pull/${pull_number}/head`,
    })
    const failed = checks.check_runs.filter(c => c.conclusion === 'failure')
    if (failed.length > 0) {
      return { eligible: false, reason: `CI check failed: ${failed[0].name}` }
    }
    // If checks still pending, don't auto-merge yet
    const pending = checks.check_runs.filter(c => c.status !== 'completed')
    if (pending.length > 0) {
      return { eligible: false, reason: 'CI checks still pending' }
    }
  }

  // 7. Package.json patch-only verification
  const pkgFile = files.find(f => f.filename === 'package.json')
  if (pkgFile) {
    const isPatchOnly = await verifyPatchBumpsOnly(octokit, owner, repo, pull_number, pkgFile)
    if (!isPatchOnly) {
      return { eligible: false, reason: 'package.json has non-patch version bumps' }
    }
  }

  return { eligible: true, reason: 'All auto-merge criteria met' }
}

export async function autoMergePR(prUrl: string, githubToken: string): Promise<void> {
  const octokit = new Octokit({ auth: githubToken })
  const { owner, repo, pull_number } = parsePrUrl(prUrl)

  await octokit.pulls.merge({
    owner, repo, pull_number,
    merge_method: 'squash',
    commit_title: `[auto-merge] ${prUrl}`,
  })
}

function parsePrUrl(url: string): { owner: string; repo: string; pull_number: number } {
  // https://github.com/{owner}/{repo}/pull/{number}
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (!match) throw new Error(`Invalid PR URL: ${url}`)
  return { owner: match[1], repo: match[2], pull_number: parseInt(match[3]) }
}

async function verifyPatchBumpsOnly(
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number,
  pkgFile: { filename: string }
): Promise<boolean> {
  // Get file content before and after
  const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number })
  const base = await octokit.repos.getContent({ owner, repo, path: pkgFile.filename, ref: pr.base.sha })
  const head = await octokit.repos.getContent({ owner, repo, path: pkgFile.filename, ref: pr.head.sha })

  const basePkg = JSON.parse(Buffer.from((base.data as any).content, 'base64').toString())
  const headPkg = JSON.parse(Buffer.from((head.data as any).content, 'base64').toString())

  // Compare all deps
  const allDeps = { ...basePkg.dependencies, ...basePkg.devDependencies }
  const allNewDeps = { ...headPkg.dependencies, ...headPkg.devDependencies }

  for (const [pkg, oldVer] of Object.entries(allDeps)) {
    const newVer = allNewDeps[pkg]
    if (newVer && newVer !== oldVer) {
      const oldParts = (oldVer as string).replace(/^[^0-9]*/, '').split('.')
      const newParts = (newVer as string).replace(/^[^0-9]*/, '').split('.')
      // Major or minor changed = not patch only
      if (oldParts[0] !== newParts[0] || oldParts[1] !== newParts[1]) {
        return false
      }
    }
  }
  return true
}
```

### Integration in `/api/jobs/[jobId]/events/route.ts`

When `approval_request` event comes in with a `prUrl`:

```typescript
// Inside the POST handler for 'approval_request' type events:
if (event.type === 'approval_request' && event.metadata?.prUrl) {
  const approval = await db.approval.create({
    data: {
      projectId: job.projectId,
      jobId: job.id,
      title: event.message,
      description: event.metadata.prUrl,
      type: event.metadata.type,
      metadata: event.metadata,
      status: 'PENDING',
    },
  })

  // Evaluate auto-merge
  const githubToken = await getDecryptedSetting('GITHUB_TOKEN')
  const result = await evaluateAutoMerge(event.metadata.prUrl, job.phase, githubToken)

  if (result.eligible) {
    await autoMergePR(event.metadata.prUrl, githubToken)
    await db.approval.update({
      where: { id: approval.id },
      data: { status: 'APPROVED', metadata: { ...event.metadata, autoMerged: true, reason: result.reason } },
    })
  }
  // If not eligible: leave as PENDING, user sees it in Approvals page
}
```

## Prisma Schema Additions

```prisma
// Add to JobPhase enum:
enum JobPhase {
  TICKET_CONTEXT_BUILD
  RESEARCH
  GENERATION
  MAINTAIN_SEO
  MAINTAIN_AEO
  MAINTAIN_BUNDLE
  MAINTAIN_CONTENT_FRESHNESS
  MAINTAIN_COMPETITOR
  MAINTAIN_INCIDENT
}

// Add priority field to Job:
model Job {
  // ... existing fields
  metadata  Json?    // For incident payload, priority flag, etc.
}

// Add autoMerged tracking to Approval:
model Approval {
  // ... existing fields
  type      String   // MAINTAIN_SEO, MAINTAIN_AEO, etc.
  metadata  Json?    // prUrl, autoMerged, reason, workflow-specific data
}
```

## File Structure (what to create)

```
src/
  app/api/
    cron/
      maintain/
        route.ts                      ← Daily cron: SEO + AEO + Bundle + Freshness
        competitor/route.ts           ← Weekly cron: Competitor re-scan
    webhooks/
      pagerduty/route.ts              ← Incident webhook
    projects/[id]/
      maintain/
        trigger/route.ts              ← Manual trigger (hackathon)
  lib/
    auto-merge.ts                     ← Auto-merge rules engine
    maintain.ts                       ← Shared maintain utilities (job creation, ECS launch wrappers)
```

## ECS Task Launch (maintain-specific)

```typescript
// src/lib/maintain.ts

export async function launchMaintainTask(jobId: string): Promise<string> {
  const job = await db.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { project: true },
  })

  // Determine which config and prompt to use based on job.phase
  const workflowMap: Record<string, { config: string; prompt: string }> = {
    MAINTAIN_SEO: { config: 'maintain-seo', prompt: 'maintain-seo' },
    MAINTAIN_AEO: { config: 'maintain-aeo', prompt: 'maintain-aeo' },
    MAINTAIN_BUNDLE: { config: 'maintain-bundle', prompt: 'maintain-bundle' },
    MAINTAIN_CONTENT_FRESHNESS: { config: 'maintain-content-freshness', prompt: 'maintain-content-freshness' },
    MAINTAIN_COMPETITOR: { config: 'maintain-competitor', prompt: 'maintain-competitor' },
    MAINTAIN_INCIDENT: { config: 'maintain-incident', prompt: 'maintain-incident' },
  }

  const wf = workflowMap[job.phase]
  if (!wf) throw new Error(`Unknown maintain phase: ${job.phase}`)

  // Read config and prompt templates
  const configTemplate = await readFile(`configs/openclaw/${wf.config}.json`, 'utf-8')
  const promptTemplate = await readFile(`configs/prompts/${wf.prompt}.md`, 'utf-8')

  // Inject variables into prompt
  const prompt = promptTemplate
    .replaceAll('{PROJECT_ID}', job.projectId)
    .replaceAll('{S3_PREFIX}', job.project.s3Prefix)
    .replaceAll('{JOB_ID}', job.id)
    .replaceAll('{CALLBACK_URL}', process.env.APPFORGE_CALLBACK_URL!)
    .replaceAll('{JOB_TOKEN}', job.jobToken)

  // Decrypt all secrets
  const secrets = await getAllDecryptedSettings()

  // Additional env vars for incident
  const extraEnv: Record<string, string> = {}
  if (job.phase === 'MAINTAIN_INCIDENT' && job.metadata) {
    extraEnv.INCIDENT_PAYLOAD = JSON.stringify((job.metadata as any).incidentPayload)
  }

  // Launch ECS task
  const taskArn = await launchECSTask({
    config: configTemplate,
    prompt,
    env: {
      ...secrets,
      JOB_ID: job.id,
      PROJECT_ID: job.projectId,
      JOB_TOKEN: job.jobToken,
      S3_PREFIX: job.project.s3Prefix,
      APPFORGE_CALLBACK_URL: process.env.APPFORGE_CALLBACK_URL!,
      ...extraEnv,
    },
  })

  await db.job.update({
    where: { id: job.id },
    data: { status: 'RUNNING', ecsTaskArn: taskArn },
  })

  return taskArn
}
```

## UI Components Needed

### Maintain Trigger Card (on project detail page)

Shows for projects in MAINTAIN status:
- "Run SEO Audit" button
- "Run Full Maintain" button (fires all workflows)
- Last maintain run timestamp + status
- Link to latest audit reports in context panel

### Approvals Page — Maintain Section

Each approval card shows:
- Badge: workflow type (SEO, AEO, Bundle, Incident, etc.)
- Title: agent's message
- PR link (clickable)
- Diff preview (embedded or link)
- Auto-merge indicator: "Auto-merged" badge if applicable
- Approve / Reject buttons (only for non-auto-merged)

### Maintain Activity Timeline (project detail)

Chronological list of maintain events:
- "SEO Audit — 3 issues found, 2 fixed" (link to report)
- "AEO — 5 FAQ questions added" (link to PR)
- "Competitor Alert: {competitor} launched new feature" (link to intel report)
- "INCIDENT — 500 on /api/users — fix PR opened" (link to incident report)
