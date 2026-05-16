# AppForge — Phase: Maintain

> **Hackathon Scope (1h):** SEED-ONLY — a pre-seeded demo project sits in MAINTAIN state with one PENDING approval. No live agent run in 1h scope. Full design below is the production roadmap. See `hackathon-implementation-plan.md`.

## Purpose

Keep the deployed application healthy, visible, and improving. Runs on a cron schedule and in response to production incidents. Handles SEO, AEO, X posting, performance, security, and incident response.

## Trigger Types

### 1. Cron (daily, 9am)
`0 9 * * *` — proactive audits: SEO crawl, AEO gap check, dependency vulnerabilities, Core Web Vitals.

Also fires immediately after:
- Every generation deploy
- Every maintain PR merge
(post-deploy verification crawl)

### 2. Incident (PagerDuty webhook — priority)
PagerDuty hits `/api/webhooks/pagerduty`. AppForge verifies HMAC signature → creates priority job → **skips queue, spins immediately**. Does not wait for active cron runner.

## Context Engine — What Agent Loads

**Always loaded by AppForge before agent starts:**
- `platform-constraints.md` — hosting limits
- `index.md` — full catalog of all project context files
- `project-context.md` — current project state, deployment URLs, known issues

**Agent pulls on demand (guided by index — typical for maintain):**
- `ideation/competitors.md` — for AEO question targeting
- `ideation/product-brief.md` — for SEO/AEO content accuracy
- `generation/deployment.md` — GitHub repo URL, Vercel URL
- `generation/spec.md` — what was built (incident diagnosis)
- `generation/known-issues.md` — for incident correlation
- Recent `maintain/incident-*.md` — last 5, for pattern detection

### Injected as env vars
- `GITHUB_TOKEN`
- `VERCEL_TOKEN` — for deployment status + runtime logs
- `X_API_KEY` — for posting
- `TRIGGER_TYPE` — `cron` | `incident`
- `INCIDENT_PAYLOAD` — full PagerDuty JSON (incident trigger only)

## SEO Workflow (cron)

1. Fetch `/sitemap.xml` from live Vercel URL → get all page URLs
2. Crawl each URL with Playwright headless — read rendered HTML
3. Audit per page: meta title, meta description, Open Graph tags, h1/h2 structure, canonical URL, JSON-LD presence
4. Run PageSpeed Insights API for Core Web Vitals (free, no key needed)
5. Check `robots.txt` and sitemap validity
6. Identify keyword opportunities from product-brief + competitor analysis
7. Generate GitHub PRs for fixes:
   - Meta tag edits → modify existing components
   - New content pages (blog, landing) → new `.tsx` files
   - Sitemap updates → update `sitemap.xml`
8. Apply auto-merge rules (see below)
9. Write `maintain/seo-audit-{date}.md`

## AEO Workflow (cron)

AEO = optimizing for AI search engines (Perplexity, ChatGPT, Google AI Overviews). These systems cite pages that directly answer questions.

1. Read product-brief + competitors — understand the product category
2. Generate top 20 questions a user would ask an AI assistant about this product category
3. Check if existing site pages answer each question (Playwright crawl)
4. For gaps: generate FAQ page content (`.tsx`) + JSON-LD FAQ schema markup
5. Open GitHub PR with new FAQ page → auto-merges (additive, content only)
6. Write `maintain/aeo-audit-{date}.md`

**FAQ pages live on the deployed app** — not external platforms. AI search engines crawl and cite them as authoritative answers.

## X Posting (cron + event-driven)

Agent drafts and posts to X using `X_API_KEY`. Always goes through approval gate — agent drafts, user reviews, user approves, agent posts.

Use cases:
- New feature shipped → announce it
- New blog/FAQ content published → share it
- Product milestone → post it

Agent drafts copy, links the approval request with preview. User approves → agent fires the post via X API.

Reddit: out of scope (bot accounts get shadowbanned — not worth the risk).

## Production Incident Workflow (webhook trigger)

**Priority job — skips queue, spins immediately.**

1. Receive PagerDuty payload: error message, stack trace, affected service, timestamp
2. Pull Vercel runtime logs via CLI (bash MCP): `vercel logs --token $VERCEL_TOKEN {project} --limit 100`
3. Load `generation/spec.md`, `generation/known-issues.md`, recent `maintain/incident-*.md`
4. Diagnose: correlate error across PagerDuty payload + Vercel logs + known issues + spec
5. Attempt fix: write code change as GitHub PR
6. All incident fixes → approval request regardless of confidence (never auto-merge incidents)
7. Approval request includes: full diagnosis, PagerDuty context, Vercel log excerpts, PR link, recommended action
8. Write `maintain/incident-{id}.md`

## Bundle Size Drift Tracking (cron)

1. Measure JS bundle size after each audit (record in `maintain/bundle-{date}.md`)
2. Compare against previous audit baseline
3. If bundle grows >10% since last audit → flag with breakdown of largest chunks
4. Suggest targeted fixes: code-splitting, lazy loading, tree-shaking, dead code removal
5. Open GitHub PR with changes
6. Track trend over time — surface in maintain dashboard

## Analytics-Driven Insights (cron)

1. Pull Vercel Analytics: Web Vitals, page views, bounce rates, traffic sources
2. Identify high-bounce pages → suggest copy/layout/CTA changes
3. Identify slow pages → targeted performance fixes
4. Identify dead pages (zero or near-zero traffic) → flag for removal or SEO boost
5. Produce insight report: `maintain/analytics-{date}.md`
6. No auto-PRs — generates recommendations surfaced to user in Approvals page for decision

## Competitor Re-Scan (cron, weekly)

1. Pull original competitor list from ideation artifacts
2. Re-crawl competitor sites (Playwright headless)
3. Detect changes: new features, pricing changes, new landing pages, positioning shifts
4. Cross-reference with current app capabilities — identify gaps or opportunities
5. Produce intelligence report: `maintain/competitor-update-{date}.md`
6. No PRs — purely informational. Surfaces as "Intel Update" card in dashboard

## Content Freshness (cron)

1. Scan all content pages (blog posts, landing pages, docs) on deployed site
2. Check publish/last-modified dates
3. Flag content older than configurable threshold (default: 90 days)
4. Cross-reference stale content with current keyword trends (from SEO workflow data)
5. Suggest refreshed copy, updated stats, new examples
6. Open GitHub PRs with updated content
7. Apply auto-merge rules (additive content updates to whitelisted files → auto-merge eligible)

## Performance & Security (cron)

- `npm audit` on deployed repo → flag vulnerabilities
- Patch-version dep bumps → auto-merge PR
- Major/minor dep bumps → approval request
- Core Web Vitals regression from PageSpeed → flag for investigation

## Auto-Merge Rules (rule-based, not LLM-scored)

**Auto-merge if ALL:**
- Purely additive (no deletions in logic files)
- Touches only: meta tags, `sitemap.xml`, `robots.txt`, JSON-LD schema files, new content `.tsx` files, `package.json` patch bumps
- PR passes all CI checks
- ≤5 files touched

**Flag for approval if ANY:**
- Modifies or deletes existing logic
- Touches `.ts`/`.tsx`/`.js`/`.jsx` source files (beyond new content pages)
- Database schema change
- Major/minor dep version bump
- CI checks fail
- Incident fix (always, no exceptions)

## Approval Requests

All flagged items → Approvals page:
- Plain-English summary of what agent wants to do
- Full reasoning with citations (Lighthouse report, PagerDuty alert, Vercel log excerpts, source URLs)
- GitHub PR link + diff preview
- Approve / Reject

## Context Engine — Exit Checklist

Before container exits:
1. Append run block to `log.md` — always, every run
2. Update `index.md` — register any new maintain artifact files
3. Rewrite `project-context.md` — **only if something changed:**
   - Known Issues resolved or new ones found → update
   - Fix deployed → update Last deploy date + Decision Log
   - Scope change → update relevant sections
   - SEO/AEO cron with no structural changes → do NOT touch project-context.md
4. Upload all new/modified files to S3
5. Update Postgres job status → `complete`

## Outputs (written to S3)

```
maintain/
  seo-audit-{YYYY-MM-DD}.md
  aeo-audit-{YYYY-MM-DD}.md
  incident-{pagerduty-id}.md
  performance-{YYYY-MM-DD}.md
  x-posts-{YYYY-MM-DD}.md              ← log of approved + posted X content
  bundle-{YYYY-MM-DD}.md               ← bundle size snapshot + drift analysis
  analytics-{YYYY-MM-DD}.md            ← traffic insights, bounce rates, recommendations
  competitor-update-{YYYY-MM-DD}.md    ← competitor changes, gaps, opportunities
  content-freshness-{YYYY-MM-DD}.md    ← stale content flagged + refresh suggestions
```

`project-context.md` updated only when something in it changes: Known Issues (incident resolved or new one found), Last deploy date (after a fix lands), Decision Log (significant architectural change). SEO/AEO cron runs that produce no structural changes do not touch `project-context.md`. `log.md` is appended on every run regardless.

## Blocker Scenarios

| Blocker | Required input |
|---------|---------------|
| `GITHUB_TOKEN` missing/expired | Re-enter in settings |
| `VERCEL_TOKEN` missing | Re-enter in settings |
| `X_API_KEY` missing | Re-enter in settings |
| Incident cause unclear after full diagnosis | User decision — agent presents options with evidence |
| Major dep breaking change | User decision |

## Cron Schedule (configurable in settings)

| Workflow | Schedule | Default |
|----------|----------|---------|
| SEO, AEO, Performance, Security, Bundle Size, Content Freshness | Daily | `0 9 * * *` |
| Analytics-Driven Insights | Daily | `0 9 * * *` |
| Competitor Re-Scan | Weekly | `0 9 * * 1` (Monday 9am) |
| X Posting | Event-driven + daily check | `0 9 * * *` |

Managed via Vercel Cron — hits `/api/cron/maintain` which queues maintain jobs for all active projects in Maintain phase. Competitor re-scan runs on separate weekly cron hitting `/api/cron/maintain/competitor`.
