# AppForge — Phase: Maintain

## Purpose

Keep the deployed application healthy, visible, and improving. Runs on a cron schedule and in response to production incidents. Handles SEO, AEO, performance, security, and production incident response.

## Trigger Types

### 1. Cron (scheduled)
Runs on a schedule (default: daily). Performs proactive audits.

### 2. Incident (webhook)
PagerDuty sends webhook to `/api/webhooks/pagerduty` when production breaks. AppForge verifies HMAC signature, creates a maintain job with incident context, queues immediately (skips queue — priority job).

## Inputs

Pulled from S3 at container start:
- All project context (brief, ideation, generation artifacts)
- Prior maintain artifacts (all previous audit reports, incident resolutions)
- `context/platform-constraints.md`

Injected as env vars:
- `GITHUB_TOKEN`
- `VERCEL_TOKEN` (for reading deployment status, logs)
- `PAGERDURY_WEBHOOK_SECRET` (for verification — already done by API route before queue)

Injected as job context (Postgres → env var):
- `TRIGGER_TYPE` — `cron` or `incident`
- `INCIDENT_CONTEXT` — PagerDuty payload (if incident trigger)

## SEO Workflow

1. Crawl deployed Vercel URL (Playwright headless)
2. Audit: meta tags, title tags, Open Graph, page speed (Lighthouse API), mobile-friendliness, sitemap presence, robots.txt
3. Check Core Web Vitals via Vercel Analytics API or PageSpeed Insights API
4. Search for keyword ranking opportunities based on product brief + competitor analysis
5. Generate fixes as GitHub PRs:
   - Meta tag updates → PR against `main`
   - New blog/landing page content → PR with new files
   - Sitemap updates → PR
6. Confidence check per PR (see auto-merge rules below)

## AEO Workflow

1. Audit existing structured data (JSON-LD) on deployed site
2. Identify missing schema types relevant to the product (FAQ, Product, Organization, BreadcrumbList)
3. Generate FAQ content targeting questions people ask AI assistants about this product category
4. Generate/update JSON-LD schema markup
5. Open GitHub PRs with changes
6. Apply confidence rules for auto-merge

## Production Incident Workflow (webhook trigger)

1. Receive PagerDuty context (error message, stack trace, affected service, timestamp)
2. Pull relevant generation artifacts (deployment.md, spec.md, known-issues.md)
3. Pull recent incident history from S3 maintain artifacts
4. Diagnose: correlate error with known code, recent deployments, known issues
5. Attempt fix: write code change, commit to GitHub as PR
6. If fix is high-confidence (touches ≤3 files, no logic changes, matches known issue pattern) → auto-merge
7. If fix is uncertain → approval request with full diagnosis + PR link
8. Write incident report to S3: `context/maintain/incident-{id}.md`

## Performance & Security (cron)

- Check Vercel deployment for dependency vulnerabilities (`npm audit`)
- Open PRs for patch-version dependency updates (auto-merge)
- Flag major/minor version updates for approval
- Monitor for new CVEs affecting the tech stack

## Auto-Merge Rules (rule-based, not LLM-scored)

**Auto-merge if ALL of the following:**
- Change is purely additive (no file deletions, no line deletions in logic files)
- Touches only whitelisted file types: HTML meta tags, `sitemap.xml`, `robots.txt`, JSON-LD in designated schema files, `package.json` patch-version bumps
- PR passes all CI checks
- Change touches ≤5 files

**Flag for approval if ANY of the following:**
- Deletes or modifies existing logic
- Touches source code files (`.ts`, `.tsx`, `.js`, `.jsx`)
- Changes database schema
- Is a major or minor dependency version bump
- PR CI checks fail
- Incident fix (all incident fixes go to approval regardless of other rules)

## Approval Requests

All flagged items appear in the Approvals page with:
- Plain-English summary of what the agent wants to do
- Full reasoning with citations (links to sources, Lighthouse report, PagerDuty alert, etc.)
- GitHub PR link
- Diff preview
- Approve / Reject

## Outputs (written to S3)

```
context/maintain/
  seo-audit-{YYYY-MM-DD}.md      ← findings + actions taken
  aeo-audit-{YYYY-MM-DD}.md      ← schema gaps + content generated
  incident-{incident-id}.md      ← diagnosis, fix, resolution status
  performance-{YYYY-MM-DD}.md    ← Core Web Vitals, dep vulnerabilities
```

## Blocker Scenarios

| Blocker | Required input |
|---------|---------------|
| GitHub token missing or expired | `GITHUB_TOKEN` |
| Vercel token missing | `VERCEL_TOKEN` |
| Incident cause unclear after analysis | User decision — agent presents diagnosis options |
| New major dependency update with breaking changes | User decision |

## Cron Schedule (configurable in settings)

Default: `0 9 * * *` (9am daily). Managed via Vercel Cron (since AppForge itself runs on Vercel) — hits `/api/cron/maintain` which queues maintain jobs for all active projects in Maintain phase.
