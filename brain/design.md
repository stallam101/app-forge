# AppForge — Design System

Dark minimal theme. Near-black canvas, white/zinc text hierarchy, blue-400 for links, white primary buttons. Status colors functional only. No purple/violet — monochrome with functional color accents.

---

## Design Philosophy

- **Near-black canvas.** `#09090b` background (not pure black — avoids OLED harshness).
- **White is the accent.** White buttons, white text, white/opacity borders.
- **Status colors are data.** Green/red/amber/blue only on badges.
- **Glass surfaces.** Cards use `bg-white/[0.04]` with `border-white/[0.06]` — subtle translucency, not solid backgrounds.
- **No purple/violet.** The entire app uses white/zinc/blue only. Zero violet, indigo, or purple anywhere.

---

## Color Tokens

```css
/* Base */
--bg:             #09090b;             /* page background */
--surface:        white/[0.04];        /* card / panel background (glass) */
--surface-hover:  white/[0.06];        /* card hover */
--border:         white/[0.06];        /* default border */
--border-hover:   white/[0.1];         /* hover border */

/* Text */
--text-primary:   white;               /* headings, project names */
--text-secondary: zinc-400;            /* descriptions, labels */
--text-muted:     zinc-600;            /* timestamps, hints */
--text-link:      blue-400;            /* links, clickable text */

/* Status (pill badges: bg-{color}-500/10 + text-{color}-400) */
--status-ready:     blue-400;          /* ready to start */
--status-running:   emerald-400;       /* agent executing (pulse animation) */
--status-blocked:   red-400;           /* needs user input */
--status-queued:    amber-400;         /* waiting in queue */
--status-review:    blue-400;          /* awaiting approval */
--status-failed:    red-400;           /* agent errored */
--status-archived:  zinc-500;          /* archived */
--status-complete:  emerald-400;       /* phase complete */

/* Interactive */
--btn-primary-bg:    white;
--btn-primary-text:  black;
--btn-primary-hover: zinc-200;
--btn-ghost-hover:   white/[0.04];
--input-bg:          white/[0.04];
--input-border:      white/[0.08];
--input-focus:       white/[0.20];
```

---

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Page title | Geist Sans | 700 (bold) | 20px |
| Section heading | Geist Sans | 600 (semibold) | 15px |
| Body / card name | Geist Sans | 600 | 14-15px |
| Label / caption | Geist Sans | 500 | 12-13px |
| Badge text | Geist Sans | 600 | 11px |
| Chat message | Geist Sans | 400 | 14px |
| Hint text | Geist Sans | 400 | 11px |
| Code / filenames | Geist Mono | 400 | 13px |

Tracking: `tracking-tight` on headings. Line height: `leading-relaxed` for chat messages.

---

## Layout

### Shell (`src/components/layout/shell.tsx`)

```
┌──────────────────────────────────────────────────────────────────┐
│ Sidebar (260px)       │  Main content area (flex-1, px-8 py-6)  │
│                       │                                          │
│  [Logo] AppForge      │  Page content                           │
│         AI FACTORY    │                                          │
│                       │                                          │
│  Dashboard            │                                          │
│  Approvals            │                                          │
│                       │                                          │
│  Settings (bottom)    │                                          │
└──────────────────────────────────────────────────────────────────┘
```

- **Background:** `bg-[#09090b]` for both sidebar and main area
- **Sidebar border:** `border-r border-white/[0.06]`
- **Logo:** White square (rounded-xl) with black Zap icon, "AppForge" bold + "AI FACTORY" subtitle below

### Sidebar Nav

- Active: `bg-white/[0.08] text-white shadow-sm rounded-xl`
- Inactive: `text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300`
- Icon size: 18px, strokeWidth 1.8
- Gap between icon and label: 12px (gap-3)

---

## Dashboard Page (`/`)

### Unforged Shelf (Ready Projects)

- Section label: `text-[#888] text-xs uppercase tracking-widest`
- "New Project" button: `bg-white text-black font-semibold px-4 py-2 rounded-lg` — prominent, top-right
- Cards in horizontal scroll row, `w-[280px]` each
- Empty state: `text-[#555] text-sm` with link to create

### Pipeline Section

- Title: "Pipeline" — `text-white text-[15px] font-semibold`
- Subtitle: "Projects move through phases as agents work autonomously"
- Four columns: Research | Generation | Maintain | Archived

### Kanban Columns

- Column header: `text-[#888] text-xs uppercase tracking-widest`
- Count badge: `text-[#555] text-[11px]`
- Drop zone: `min-h-[120px] rounded-lg`
- **Valid drop target (during drag):** `bg-green-500/10 ring-1 ring-green-500/30`
- **Valid hint (not hovered):** `bg-[#0d0d0d] ring-1 ring-[#333]`
- **Invalid target:** `opacity-40`

### Drag Behavior

- All cards are draggable (via `useDraggable` from dnd-kit)
- Drop is only accepted if `canDrop()` returns true:
  - READY → RESEARCH: only when `ideationComplete === true`
  - RESEARCH → GENERATION: only when active job status is COMPLETE
  - All other drops snap back to original position
- Drag overlay: card clone with `rotate-[2deg] scale-105 shadow-2xl opacity-90`
- Cards use `touch-none` to prevent scroll interference

---

## Project Card (`src/components/dashboard/project-card.tsx`)

```
┌──────────────────────────────────────────────┐
│  ● running               Research     [···]  │
│                                              │
│  My Fintech App                              │
│  Agent building market analysis...           │
│                                              │
│  2 min ago                                   │
└──────────────────────────────────────────────┘
```

- Container: `bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 group relative`
- Hover: `border-[#333]`
- Blocked/failed: `border-[#ef4444]`
- Archived: dimmed via status badge
- **Three-dot menu:** absolute top-right, hidden until hover (`opacity-0 group-hover:opacity-100`)
  - `onPointerDown` with `stopPropagation()` on button + backdrop + menu items (prevents drag activation)
  - Archive: fires `onStatusChange("ARCHIVED")` → optimistic update, no page reload
  - Unarchive: fires `onStatusChange("READY")` → instant
- **Click to navigate:** via `onClick` on wrapper, skipped if `didDrag` or `menuClicked` or click inside `[data-menu]`
- Status badge row has `pr-8` to avoid overlapping with three-dot menu

### Status Badges (pill style)

```tsx
<span className="inline-flex items-center gap-1.5 bg-{color}-500/10 text-{color}-400 text-[11px] font-semibold px-2 py-0.5 rounded-full">
  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
  running
</span>
```

| Status | Color | Pulse |
|--------|-------|-------|
| ready | blue-400 / blue-500/10 | no |
| running | emerald-400 / emerald-500/10 | yes |
| blocked | red-400 / red-500/10 | no |
| queued | amber-400 / amber-500/10 | no |
| review | blue-400 / white/[0.06] | no |
| complete | emerald-400 / emerald-500/10 | no |
| building | blue-400 / white/[0.06] | yes |
| archived | zinc-500 / zinc-500/10 | no |

---

## Chat / Ideation View (`/projects/[id]` and `/projects/new`)

### Header

- Back link: `text-zinc-500 hover:text-white text-[13px]`
- Project name: **editable inline** — click to edit, Enter saves, Escape cancels
  - Display: `text-white text-[15px] font-semibold` with Pencil icon on hover
  - Edit: input with `bg-white/[0.06] border-white/[0.12]` + Check button
- Archive button: ghost style, `bg-white/[0.04] border border-white/[0.06]`
- Forge button: `bg-white text-black font-semibold rounded-xl` with Zap icon

### Chat Container

- `rounded-2xl border border-white/[0.06] bg-white/[0.02]`
- Split: chat column (flex-1) + context panel (200-280px)

### Message Bubbles

- **User message:** right-aligned, `bg-white/[0.08] border-white/[0.06] rounded-2xl rounded-br-md`, User avatar (white/[0.08] circle, blue-400 User icon)
- **Agent message:** left-aligned, `bg-white/[0.04] border-white/[0.06] rounded-2xl rounded-bl-md`, Zap avatar (white/[0.08] circle, blue-400 Zap icon)
- **Empty messages:** hidden (return null if `!content.trim()`)
- Text: `text-zinc-200 text-[14px] leading-relaxed`
- Markdown: prose-invert, `prose-code:text-zinc-300 prose-code:bg-white/[0.06]`

### Composer

- Textarea: `bg-white/[0.04] border-white/[0.08] rounded-xl`, focus: `border-white/20 ring-white/10`
- Send button: white circle `h-11 w-11 bg-white text-black rounded-xl` with Send icon
- Hint: `text-zinc-700 text-[11px]` — "Press Enter to send, Shift+Enter for new line"

### Empty State (no messages)

- Centered icon: MessageSquare in `white/[0.06]` rounded-2xl
- "Start the conversation" + description text

### Typing Indicator

- Zap avatar + three bouncing dots (`bg-zinc-400/60 animate-bounce`)

### Context Panel

- Width: 200px when empty, 280px when files present (transition)
- Header: "Context" label + file count badge
- Empty: FileText icon + "Context files appear here as agents work"
- Files: FileText icon + monospace filename + size, new files get `bg-blue-400 animate-pulse` dot

---

## Approvals Page (`/approvals`)

- Title: "Approvals" 20px bold + subtitle
- **Approval cards:** `bg-white/[0.03] border-white/[0.06] rounded-xl p-5`
- Type badge: pill with color per type (blue=SEO, cyan=AEO, amber=Deps, emerald=Content, red=Incident)
- Project link: `text-blue-400 hover:underline`
- Reject button: ghost with red hover (`hover:bg-red-500/10 hover:text-red-400`)
- Approve button: `bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-lg`
- **Empty state:** Inbox icon + "All clear" + explanation + tag pills (SEO Fixes, Dep Updates, Incident Patches, Content PRs, AEO Schema)

---

## Settings Page (`/settings`)

- Four API key fields: NVIDIA, Tavily, GitHub, Vercel
- Each with: label, description, password input, eye toggle
- Save button: `bg-white text-black` — bottom of form
- Platform section: Vercel shown as active target

---

## Buttons

| Variant | Style |
|---------|-------|
| Primary | `bg-white text-black font-semibold px-4 py-2 rounded-xl hover:bg-zinc-200 active:scale-[0.97]` |
| Ghost | `bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 rounded-xl` |
| Destructive | `hover:bg-red-500/10 hover:text-red-400 rounded-xl` |
| Icon | `w-6 h-6 rounded-md hover:bg-[#222]` |

All transitions: `transition-all duration-200`.

---

## Animation

- **Duration:** 150ms micro (hover), 200ms transitions, 300ms page elements
- **Drag overlay:** `rotate-[2deg] scale-105 shadow-2xl shadow-black/50 opacity-90`
- **Status badge pulse:** `animate-pulse` on running/building states
- **New context file:** `animate-pulse` on blue dot
- **Typing indicator:** `animate-bounce` with staggered delays (0, 150ms, 300ms)
- **Press-scale:** `active:scale-[0.97]` on buttons and cards

---

## Do / Don't

| Do | Don't |
|----|-------|
| `white/[0.06]` borders | Solid colored borders (except blocked=red) |
| Pill badges with `bg-{color}/10` | Dot-only badges without background |
| `blue-400` for links | Purple/violet for anything |
| White primary buttons | Gradient colored buttons |
| `#09090b` background | Pure `#000000` (too harsh) |
| `rounded-xl` on cards/buttons | `rounded-lg` (too subtle) |
| Three-dot menu with `stopPropagation` | Inline action buttons that conflict with drag |
| Optimistic state updates | `window.location.reload()` or `router.refresh()` |
| `touch-none` on draggable elements | Default touch behavior (causes scroll conflict) |
