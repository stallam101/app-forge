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
| `awaiting message` | (Ideation only) Agent replied — waiting for the user's next chat message |
| `blocked` | Agent paused — needs user input outside the conversation (API key, decision) |
| `awaiting approval` | Phase complete, user must approve before next phase starts |
| `failed` | Agent errored — view logs |

### Card Contents
- Project name
- Current phase badge
- Last agent activity (timestamp + one-line summary)
- Quick action button:
  - Ideation card → **Open Chat** (primary), Resolve Blocker, View Logs
  - Generation / Maintain card → Approve (when applicable), Resolve Blocker, View Logs

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

## Ideation Chat Panel

Clicking an Ideation card opens the **Chat Panel** — the primary interface for that phase. Generation and Maintain cards do NOT have a chat panel; they only show logs + artifacts.

### Layout

- **Main column:** threaded conversation, user messages + agent replies in chronological order
- **Each agent reply may include:**
  - Inline citations (clickable source links)
  - File references — chips linking to wiki files written/updated that turn
  - Research summaries, niche option cards, follow-up questions
- **Composer at the bottom:** text input, send button. Sending triggers a fresh container — badge flips to `running` while the agent thinks.
- **Finalize button:** explicit user request to wrap up the conversation and produce the final artifact set.
- **Side panel:** live-rendered Context Engine artifacts (so the user sees the wiki growing in real time).
- **Logs tab:** secondary view for container output (debugging).

### Conversation Lifecycle

1. User drags project Backlog → Ideation → **first turn auto-fires** (no user message needed). Agent opens with research summary + clarifying questions.
2. User reads, replies, hits send → next turn fires.
3. Repeat until either:
   - User clicks **Finalize**
   - Agent proposes finalization, user confirms in chat
4. Finalization turn writes the full artifact set + rewrites `project-context.md` → badge moves to `awaiting approval`.
5. User reviews artifacts (via side panel or Approvals page), approves → project queues for Generation.

After approval, the conversation is read-only — preserved in `ideation/conversation.md` as historical context.

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
2. Enter: project name + one-line idea (description). One sentence is enough — the ideation conversation will refine the rest.
3. Optionally: attach reference docs, links, or additional context to seed the conversation
4. Submit → project created in Backlog
5. Drag to Ideation column (or click **Start Ideation**) → first ideation turn auto-fires, agent opens the conversation
