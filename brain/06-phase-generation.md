# AppForge — Phase: Generation

## Purpose

Build, test, and deploy the application described in ideation artifacts. Creates a GitHub repo, writes production-ready code, runs tests, and ships to Vercel via GitHub integration. Fully constrained to the target hosting platform.

## Context Engine — What Agent Loads

**Always loaded by AppForge before agent starts:**
- `platform-constraints.md` — hosting limits, load before writing a single line of code
- `index.md` — catalog of all context files (includes ideation artifacts from prior phase)
- `project-context.md` — full project state: what to build, tech stack + WHY, feature checklist

**Agent pulls on demand (guided by index):**
- `ideation/tech-stack.md` — stack rationale before writing any code
- `ideation/features.md` — full feature list to implement
- `ideation/product-brief.md` — if unclear on product intent during implementation
- `ideation/conversation.md` — full ideation chat history if origin/intent needs deeper context (the conversation captures the WHY behind every decision in product-brief.md)
- Any other ideation files as needed

## Execution Flow

```
1. Load Context Engine core files
2. Pull ideation artifacts needed for implementation plan
3. Confirm stack is platform-compliant (platform-constraints.md)
4. Create GitHub repo via GitHub API (name: appforge-{project-slug})
5. Scaffold project
6. Implement MVP features from features.md — feature by feature
7. Write tests (unit + integration, E2E where applicable)
8. Run tests — iterate on failures (max 3 self-correction rounds)
9. Commit all code with descriptive commit messages
10. Vercel auto-deploys via GitHub integration
11. Verify deployment URL is live
12. Run Context Engine exit checklist
```

## Platform Compliance

Before writing any code, agent reads `platform-constraints.md` and confirms:
- Chosen stack is supported
- No long-running processes planned
- Database choice is platform-compatible
- No out-of-scope services in architecture

If ideation recommends something incompatible, agent substitutes nearest compliant alternative and notes it in `project-context.md` decision log.

## GitHub Repo Setup

- Repo name: `appforge-{project-slug}`
- Initial commit: scaffolded project
- Subsequent commits: feature-by-feature with descriptive messages
- Branch strategy: `main` only for MVP (agent has full control, no PR flow)

## Vercel Deployment

Tooling: **Vercel CLI via bash MCP** (`mcp-server-commands`). No dedicated Vercel MCP — the CLI covers all needed operations and `VERCEL_TOKEN` is required either way.

1. Agent creates GitHub repo via GitHub MCP
2. Agent creates and links Vercel project via CLI:
   ```bash
   vercel link --yes --token $VERCEL_TOKEN --project appforge-{slug}
   ```
   If project doesn't exist yet, create it first:
   ```bash
   vercel project add appforge-{slug} --token $VERCEL_TOKEN
   vercel link --yes --token $VERCEL_TOKEN --project appforge-{slug}
   ```
3. Every push to `main` → Vercel auto-deploys via linked integration
4. Agent reads deployment URL from CLI output or:
   ```bash
   vercel inspect --token $VERCEL_TOKEN appforge-{slug}
   ```

Note: Vercel GitHub app must be installed on the org/user. Agent must explicitly create + link the project before pushing — GitHub app alone does not auto-create Vercel projects.

## Testing

- Framework-appropriate runner: Jest, Vitest, Playwright for E2E
- Test failures: agent iterates max 3 rounds
- Still failing after 3 rounds: blocker — surfaces failure context to user
- Dev server started locally for E2E tests, killed after tests pass

## Outputs

Agent decides what files to create. All registered in `index.md`. Typical generation outputs:

```
generation/
  spec.md          ← what was built, arch decisions, deviations from ideation plan
  test-report.md   ← test results, coverage, skipped tests
  deployment.md    ← GitHub repo URL, Vercel URL, required env vars
  known-issues.md  ← deferred features, tech debt, shortcuts taken
```

Additional files as needed (e.g. `generation/api-design.md` for a complex API, `generation/data-model.md` for a complex schema). Agent decides.

## Context Engine — Exit Checklist

Before container exits:
1. Append run block to `log.md`
2. Update `index.md` — register all new files with description + when-to-read
3. Rewrite `project-context.md`:
   - Check off features built in Feature Scope
   - Fill Architecture section
   - Fill GitHub URL + Deployment URL in Current State
   - Update Known Issues one-liner in project-context.md → links to known-issues.md
   - Add decision log entries for substitutions, deferred features, architectural choices
4. Upload all new/modified files to S3
5. Update Postgres job status → `complete`

## Blocker Scenarios

| Blocker | Required input |
|---------|---------------|
| `GITHUB_TOKEN` missing | Re-enter in settings |
| `VERCEL_TOKEN` missing | Re-enter in settings |
| Test failures after 3 rounds | User decision — review failure context |
| Ambiguous feature implementation | User decision — agent presents options |
| External API required for core feature (e.g. Stripe) | Relevant API key |

## Prompt Template Skeleton

```
You are an expert software engineer operating within the AppForge Context Engine.

## Context Engine Instructions
1. Read platform-constraints.md first — never write code outside these limits
2. Read index.md — understand what context exists
3. Read project-context.md — understand what to build, the stack decisions and WHY
4. Pull additional ideation files as needed (see index for what's available)
5. Before exiting: append to log.md, update index.md, rewrite project-context.md with deployment URLs + built features checked off

## Your Task
Build the application described in project-context.md. Deploy to GitHub and Vercel.
Implement MVP features only. Write tests. Commit feature-by-feature.
Write whatever context files are useful. Cross-link related files.
Document all deviations from ideation plan in project-context.md decision log.

## Platform Constraints
Read platform-constraints.md. Every technology choice must comply.
```
