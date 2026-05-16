# AppForge — Interface

## Dashboard Layout

```
┌── Sidebar (260px) ──┬─────────────────────────────────────────────┐
│                     │  Your Projects (Unforged)    [+ New Project] │
│  [⚡] AppForge      │  [Card] [Card] [Card] →scroll               │
│       AI FACTORY    │                                              │
│                     ├──────────────────────────────────────────────┤
│  Dashboard ●        │  Pipeline                                    │
│  Approvals          │  Research → Build → Maintain                 │
│                     │                                              │
│                     │  🔍Research  💻Generation  🛡Maintain  📦Archived│
│  Settings           │  [Card]      [Card]        [Card]            │
│                     │  [Card]      [Card]                          │
└─────────────────────┴──────────────────────────────────────────────┘
```

### Unforged Shelf (above kanban)

Projects that completed ticket creation. Horizontal scrolling row. White "New Project" button top-right.

### Kanban Columns

```
Research | Generation | Maintain | Archived
```

Each column has an icon (Search/Cpu/Shield/Archive) and a count badge. Empty columns show the column icon with "No projects in {phase}" text.

## Card Interactions

### Drag and Drop

- All cards are draggable via dnd-kit `useDraggable`
- Drop validation enforced by `canDrop()`:
  - READY → RESEARCH: only when `ideationComplete === true`
  - RESEARCH → GENERATION: only when active job is COMPLETE
  - Invalid drops snap back — no API call, no error shown
- Valid drop targets highlight green during drag
- Invalid columns dim to 40% opacity
- Drag overlay shows rotated card clone with shadow

### Three-Dot Menu

- Appears on card hover (top-right corner)
- All pointer events stopped from propagating to drag handler
- Options:
  - **Archive** (non-archived cards): moves card to Archived column instantly (optimistic)
  - **Unarchive** (archived cards): moves card back to Unforged shelf instantly (optimistic)
- API fires in background — no page reload

### Click to Navigate

- Click card → navigates to `/projects/{id}`
- Click + drag → drags card, no navigation
- Click three-dot menu → opens menu, no navigation

## Card States

| Badge | Style | Meaning |
|-------|-------|---------|
| `ready` | blue pill | Ticket complete, waiting for Research |
| `queued` | amber pill | In column queue |
| `running` | emerald pill (pulse) | Agent executing |
| `blocked` | red pill + red border | Needs user input |
| `review` | blue pill | Phase complete, awaiting approval |
| `failed` | red pill + red border | Agent errored |
| `complete` | emerald pill | Phase finished |
| `archived` | zinc pill | Archived |

## Phase Transitions

User-controlled. When a phase completes, card shows `review` badge. User can:
- Drag card to next column (if status is COMPLETE)
- Click **Approve** button (triggers next phase)

No automatic phase advancement. Ever.

## Ticket Creation Page (`/projects/new`)

Full-page chat interface. Project created on mount, URL updated to `/projects/{id}/chat`.

### Layout

```
┌── Header: ← Dashboard / [editable name] ✏️         [Archive] [⚡ Forge] ──┐
│                                                                            │
│  ┌─── Chat (flex-1) ────────────────────────┬── Context Panel (200-280px) ┐│
│  │                                          │                              ││
│  │  [🤖] Agent research response            │  Context                     ││
│  │       with markdown formatting           │  ─────────                   ││
│  │                                          │  brief.md          1.2kb     ││
│  │                      [👤] User message   │  index.md  ●new    0.4kb     ││
│  │                                          │                              ││
│  │  [🤖] ●●● (typing)                      │                              ││
│  │                                          │                              ││
│  ├──────────────────────────────────────────┤                              ││
│  │ [textarea              ] [→]             │                              ││
│  │ Press Enter to send, Shift+Enter newline │                              ││
│  └──────────────────────────────────────────┴──────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────┘
```

### Editable Project Name

- Click project name in breadcrumb → inline input
- Enter saves (PATCH `/api/projects/{id}`), Escape cancels
- Pencil icon on hover as affordance

### Chat Messages

- User: right-aligned, User avatar, `bg-white/[0.08]` bubble
- Agent: left-aligned, Zap avatar, `bg-white/[0.04]` bubble, markdown rendered
- Empty messages not rendered
- Typing indicator: Zap avatar + bouncing dots

### Context Panel

- Narrower (200px) when empty, expands to 280px with files
- Shows file count badge in header
- New files pulse blue dot
- Each file shows icon + name + size

### Forge Button

- `bg-white text-black` in header row
- Disabled until agent marks `readyToForge`
- Triggers autonomous context-build → redirects to dashboard

## Approvals Page (`/approvals`)

### Layout

- Title + subtitle explaining purpose
- Approval cards list, each with:
  - Type badge (colored pill: blue=SEO, cyan=AEO, amber=Deps, emerald=Content, red=Incident)
  - Project link (blue-400, clickable)
  - Title + description
  - Approve button (emerald gradient) + Reject button (ghost with red hover)

### Empty State

- Inbox icon + "All clear" message
- Explanation of what generates approvals
- Tag pills: SEO Fixes, Dep Updates, Incident Patches, Content PRs, AEO Schema

## Settings Page (`/settings`)

- Four API key fields: NVIDIA, Tavily, GitHub, Vercel
- Each with label, description, password input, eye toggle
- Save button (white primary)
- Platform section showing Vercel as active hosting target

## Hard Stoppers

When agent hits a blocker:
1. Job status → BLOCKED in Postgres
2. Card border turns red, badge shows `blocked`
3. User clicks card → sees blocker info
4. User provides missing input → job re-queued

## Login Page (`/login`)

- Centered layout with background glow effect
- White Zap logo icon (black icon on white square)
- "AppForge" title + "AI Software Factory" subtitle
- Email + password form
- White "Sign In" button
- Single admin account: `admin@appforge.dev`
