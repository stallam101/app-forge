# Project: AppForge

## Brain Docs (read first)

Before starting any task, read `brain/index.md`. Follow links to relevant phase or architecture docs.

After making significant changes to architecture, interfaces, agent behavior, or data models — update the relevant brain doc. Do not leave stale decisions. Overwrite, don't append.

Brain doc locations:
- `brain/index.md` — start here, key decisions index
- `brain/01-core-idea.md` — vision + phase overview
- `brain/02-interface.md` — kanban UI, user flows, approvals
- `brain/03-architecture.md` — AWS stack, infra, data stores
- `brain/04-technical-deep-dive.md` — SSE, container lifecycle, backend structure
- `brain/05-phase-ideation.md` — ideation agent
- `brain/06-phase-generation.md` — generation agent
- `brain/07-phase-maintain.md` — maintain agent
- `brain/08-context-engine.md` — Context Engine: wiki-based context system powering all agents (read before touching agent prompts or S3 structure)


## Agent Workflow

For features with independent frontend + backend work: spawn parallel subagents via worktrees.
For UI: invoke `ui-ux-pro-max` skill.
For code quality: invoke `karpathy-guidelines` skill.

## Verification

After every feature:
1. `npm run build` — must pass, zero type errors
2. `npm run dev` — start dev server
3. Playwright: navigate to affected page, run happy path
4. Playwright: `browser_console_messages` — no errors
5. Playwright: check API routes return correct status codes
6. Fix anything found before marking done

