# AppForge — Interface

> **Hackathon Scope (1h):** Drag-and-drop is in the cut list — phase advance via button in 1h scope. Kanban + Research view ship as money-shot UI; Generation and Maintain detail views are honest stub placeholders. See `hackathon-implementation-plan.md`.

## Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  Ready to Start                                      │
│  [Card] [Card]                                       │
├─────────────────────────────────────────────────────┤
│  Research  │  Generation  │  Maintain  │  Archived  │
│  [Card]    │  [Card]      │  [Card]    │            │
└─────────────────────────────────────────────────────┘
```

### Ready Shelf (above kanban)
Tickets that have completed the ticket creation conversation and context-build. Waiting for user to drag into Research. Cards show a green `ready` badge. This is NOT a kanban column — it's a holding area.

### Kanban Columns
```
Research | Generation | Maintain | Archived
```

One project card per column can be actively running at a time — others queue behind it within that column.

Hackathon 1h: drag-and-drop deferred; phase advance by button click. Auto-refresh kanban every 2s while any project is RUNNING.

## Card States

| Badge | Meaning |
|-------|---------|
| `ready` | Ticket creation complete — waiting to be dragged to Research |
| `queued` | In the column queue, waiting for active runner to finish |
| `running` | Agent currently executing |
| `blocked` | Agent paused — needs user input (API key, decision) |
| `awaiting approval` | Phase complete — user must approve before next phase |
| `failed` | Agent errored — view logs |

## Card Contents
- Project name
- Current phase + badge
- Last agent activity (timestamp + one-line summary)
- Quick action button: Approve (when applicable) / Resolve Blocker / View Logs

## Phase Transitions

User-controlled. When a phase completes, card moves to `awaiting approval`. User can:
- Click **Approve → [Next Phase]** button on the card
- Drag card to next column

No automatic phase advancement. Ever.

## Hard Stoppers

When an agent hits a blocker (missing API key, OAuth required, ambiguous decision):
1. Agent writes `BLOCKED` + reason to Postgres
2. Container exits cleanly — job stays as `blocked`
3. Kanban card turns red, badge shows `blocked`
4. Browser push notification fires
5. User clicks card → blocker modal:
   - What the agent needs
   - Form to provide it (API key input, decision radio, etc.)
   - "Resume" button — re-queues job with new context

## Ticket Creation Page (`/projects/new`)

Full-page conversational interface. Not a modal.

### Layout
- **Main column:** threaded conversation — user messages + agent replies in chronological order
- **Each agent reply includes:** inline citations, research summaries, clarifying questions, niche option cards
- **Composer at bottom:** text input + send button. Sending triggers a fresh container turn.
- **Side panel:** live Context Engine artifacts — user sees wiki files growing in real time
- **Submit button:** when user is satisfied with the direction → triggers autonomous context-build → redirects to dashboard with toast

### Conversation Lifecycle
1. User clicks **+ New Project** → navigates to `/projects/new`
2. User enters project name + one-line idea → first agent turn auto-fires
3. Agent does light research sweep → replies with acknowledgment + 2–4 clarifying questions
4. User replies → subsequent turns fire, research deepens as niche narrows
5. User clicks **Create Ticket** when satisfied
6. Autonomous context-build runs → toast fires top-right: "Building context..." + spinner
7. Done → redirect to dashboard, ticket appears in Ready shelf
8. Conversation is read-only from this point — preserved in `ideation/conversation.md`

## Approvals Page

Separate page. Inbox for all pending approval requests (primarily from Maintain).

Each request shows:
- Plain-English summary of what agent wants to do
- Full reasoning + citations (source links, Lighthouse reports, PagerDuty alerts)
- GitHub PR link + diff preview
- Approve / Reject buttons

## Settings Page

- **API Keys / Tokens:** GitHub token, Vercel token, Reddit API key, X API key, PagerDuty secret. Secure form. Encrypted in Postgres.
- **Platform Constraints:** Hosting provider for generated apps (default: Vercel). Editable.
- **Admin account:** Password change only.
