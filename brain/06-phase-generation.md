# AppForge — Phase: Generation

## Purpose

Build, test, and deploy the application described in ideation artifacts. Creates a GitHub repo, writes production-ready code, runs tests, and ships to Vercel via GitHub integration. Fully constrained to the target hosting platform.

## Inputs

Pulled from S3 at container start:
- `context/brief.md`
- `context/platform-constraints.md`
- `context/ideation/` — all ideation output files (product brief, features, tech stack, etc.)

Injected as env vars:
- `GITHUB_TOKEN` — for repo creation and commits
- Platform constraints already in context files

## Execution Flow

```
1. Read ideation artifacts → understand what to build
2. Create GitHub repo via GitHub API (name from project slug)
3. Scaffold project (e.g. npx create-next-app for Next.js projects)
4. Implement features from features.md (MVP tier first)
5. Write tests (unit + integration where applicable)
6. Run tests — fix failures iteratively
7. Commit all code to GitHub repo
8. Vercel auto-deploys via GitHub integration (no manual step needed)
9. Verify deployment URL is live
10. Write output artifacts to /tmp/output/
```

## Platform Compliance

Before writing any code, agent reads `platform-constraints.md` and confirms:
- Chosen stack is supported
- No long-running processes planned
- Database choice is platform-compatible
- No out-of-scope services referenced in architecture

If ideation tech-stack.md recommends something incompatible, agent substitutes the nearest compliant alternative and notes the change in `spec.md`.

## GitHub Repo Setup

- Repo name: `appforge-{project-slug}` (public or private based on settings)
- Initial commit: scaffolded project
- Subsequent commits: feature-by-feature (descriptive commit messages)
- Branch strategy: `main` only for MVP (no PR flow within generation — agent has full control)

## Vercel Deployment

No Vercel CLI or token required. Setup:
1. User has GitHub integration enabled on their Vercel account (one-time manual step — flagged as blocker if not done)
2. Agent creates GitHub repo → Vercel auto-detects and creates project
3. Every push to `main` → auto-deploy
4. Agent reads deployment URL from Vercel API after push (requires `VERCEL_TOKEN` if reading deploy status)

## Testing

Agent runs tests inside the container before final commit:
- Framework-appropriate test runner (Jest, Vitest, Playwright for E2E)
- If tests fail: agent iterates (max 3 self-correction rounds)
- If tests still fail after 3 rounds: blocker — surfaces failure context to user
- Dev server started locally for E2E tests, killed after tests pass

## Outputs (written to S3)

```
context/generation/
  spec.md              ← what was built, architecture decisions, deviations from ideation
  test-report.md       ← test results summary, coverage, any skipped tests
  deployment.md        ← GitHub repo URL, Vercel deployment URL, env vars required
  known-issues.md      ← anything deferred, shortcuts taken, tech debt flagged
```

## Blocker Scenarios

| Blocker | Required input |
|---------|---------------|
| GitHub token missing | `GITHUB_TOKEN` |
| Vercel GitHub integration not set up | User action — link Vercel to GitHub account |
| Test failures after 3 rounds | User decision — review failure context, decide to proceed or fix |
| Ambiguous feature implementation | User decision — agent presents options |
| Required external API for core feature (e.g. Stripe) | Relevant API key |

## Prompt Template Skeleton

```
You are an expert software engineer.

## Your Task
Build the application described in the ideation documents. Deploy it to GitHub and Vercel.

## Platform Constraints
{platform-constraints}

## Ideation Artifacts
{ideation artifacts injected here}

## Rules
- Only use technologies listed in platform-constraints.md
- Implement MVP features from features.md only
- Write tests for all core functionality
- Commit feature-by-feature with descriptive messages
- Document all deviations from ideation in spec.md

## Outputs
Write to /tmp/output/:
- spec.md
- test-report.md
- deployment.md
- known-issues.md
```
