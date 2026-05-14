# AppForge — Interface

## Kanban Board (main view)

Primary interface. Columns map to phases. One project card per phase can be actively running at a time — others queue behind it.

### Columns
```
Backlog | Ideation | Generation | Maintain | Archived
```

### Card States (badge on each card)
| Badge | Meaning |
|-------|---------|
| `queued` | Waiting for active runner to finish |
| `running` | Agent currently executing |
| `blocked` | Agent paused — needs user input |
| `awaiting approval` | Phase complete, user must approve before next phase starts |
| `failed` | Agent errored — view logs |

### Card Contents
- Project name
- Current phase badge
- Last agent activity (timestamp + one-line summary)
- Quick action button (Approve / Resolve Blocker / View Logs)

## Phase Transitions

User-controlled. When a phase completes, card moves to `awaiting approval`. User can:
- Click **Approve → [Next Phase]** button on the card
- Drag card to next column on the kanban board

No automatic phase advancement. Ever.

## Hard Stoppers

When an agent hits a blocker (missing API key, OAuth required, ambiguous user decision):
1. Agent writes `BLOCKED` status + reason to Postgres
2. Container exits cleanly — job stays in queue as `blocked`
3. Kanban card turns red, badge shows `blocked`
4. Browser push notification fires with reason
5. User clicks card → sees blocker modal with:
   - What the agent needs
   - A form to provide it (API key input, decision radio, etc.)
   - "Resume" button — re-queues the job with new context injected

## Approvals Page

Separate page from kanban. Inbox for all pending approval requests (primarily from Maintain phase).

Each approval request shows:
- What the agent wants to do (plain English)
- Full reasoning + citations (links, sources)
- Link to the GitHub PR
- Diff preview
- Approve / Reject buttons

Maintain phase auto-merges high-confidence changes (rule-based). Low-confidence → approval request appears here.

## Settings Page

- **API Keys / Tokens:** GitHub token, Vercel token, Reddit API key, X API key, PagerDuty secret. Entered via secure form. Stored encrypted in Postgres. Editable anytime.
- **Platform Constraints:** Which hosting provider generated apps target (default: Vercel). Editable.
- **Admin account:** Password change only.

## New Project Flow

1. Click **+ New Project**
2. Enter: project name + description (one sentence minimum, no maximum)
3. Optionally: attach reference docs, links, or additional context
4. Submit → project created in Backlog
5. Drag to Ideation column (or click **Start Ideation**) to queue it
