# AppForge — Design System

Vercel dashboard aesthetic. OLED black, white highlights, monochrome. Status colors functional only — never decorative. Every decision here has a reason; nothing speculative.

---

## Design Philosophy

- **Black canvas.** Pure #000000 background. Content lives on it, not inside containers.
- **White is the accent.** No brand color. White at full and reduced opacity does all the work.
- **Status colors are data, not style.** Green/red/amber/blue only on badges and alerts.
- **Density without clutter.** Vercel dashboard packs real information. Generous spacing within components, tight spacing between them.
- **No decorative chrome.** No gradients, no shadows on dark surfaces, no rounded-corner overkill. Borders are 1px, always `#1a1a1a`.

---

## Color Tokens

```css
/* Base */
--bg:           #000000;   /* page background — true OLED black */
--surface:      #0a0a0a;   /* card / panel background */
--surface-2:    #111111;   /* elevated surface (dropdowns, tooltips) */
--border:       #1a1a1a;   /* default border */
--border-focus: #333333;   /* focused / hover border */

/* Text */
--text-primary:  #ffffff;
--text-secondary: #888888;
--text-muted:    #555555;

/* Status (functional only — never decorative) */
--status-ready:    #3b82f6;   /* blue   — ticket ready to start */
--status-running:  #22c55e;   /* green  — agent executing */
--status-blocked:  #ef4444;   /* red    — needs user input */
--status-queued:   #f59e0b;   /* amber  — waiting in queue */
--status-approval: #a855f7;   /* purple — awaiting user approval */
--status-failed:   #ef4444;   /* red    — same as blocked */
--status-archived: #555555;   /* gray   — archived */

/* Interactive */
--btn-primary-bg:   #ffffff;
--btn-primary-text: #000000;
--btn-ghost-hover:  rgba(255,255,255,0.06);
--input-bg:         #0a0a0a;
--input-border:     #1a1a1a;
--input-border-focus: #ffffff;
```

Tailwind config maps these as CSS variables via `hsl()` pattern compatible with shadcn/ui.

---

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Page title | Geist Sans | 500 | 18px |
| Section heading | Geist Sans | 500 | 14px |
| Body | Geist Sans | 400 | 14px |
| Label / caption | Geist Sans | 400 | 12px |
| Badge text | Geist Sans | 500 | 11px |
| Code / logs | JetBrains Mono | 400 | 13px |
| Chat message | Geist Sans | 400 | 14px |

Line height: 1.5 for body, 1.2 for headings. Letter spacing: default (no tracking adjustments).

---

## Spacing Scale

4px base unit. All spacing is a multiple of 4.

```
4   — tight intra-component (icon gap, badge padding)
8   — component internal padding (small)
12  — component internal padding (default)
16  — component internal padding (large) / section gap small
24  — section gap default
32  — section gap large
48  — page section separation
```

---

## Layout

### Shell

```
┌─────────────────────────────────────────────────────────────────┐
│ Sidebar (220px fixed)  │  Main content area (flex-1)            │
│                        │                                        │
│  AppForge logo         │  Page content                         │
│  ─────────────────     │                                        │
│  Nav items             │                                        │
│                        │                                        │
│  ─────────────────     │                                        │
│  Settings              │                                        │
│  (bottom)              │                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Sidebar:** `bg-[#000] border-r border-[#1a1a1a]`. Width 220px, fixed. Logo top-left. Nav items middle. Settings pinned bottom.

**Main area:** `bg-[#000000]`. Padding: 24px. Max-width: none (full-width kanban).

### Sidebar Nav Items

```
[icon]  Dashboard           ← active: text-white, bg-[#111]
[icon]  Approvals           ← inactive: text-[#888]
[icon]  Settings
```

Hover: `bg-[#0a0a0a]`. Active: `bg-[#111111] text-white`. Icon size: 16px, Lucide.

---

## Dashboard Page (`/`)

```
┌─ Sidebar ──┬─────────────────────────────────────────────────────┐
│            │  Ready to Start                    [+ New Project]  │
│            │  ─────────────────────────────────────────────────  │
│            │  [Card: ready] [Card: ready]                        │
│            │                                                      │
│            │  ─────────────────────────────────────────────────  │
│            │  Research        Generation    Maintain   Archived   │
│            │  ──────────      ──────────    ────────   ────────  │
│            │  [Card]          [Card]        [Card]               │
│            │  [Card queued]                                       │
└────────────┴─────────────────────────────────────────────────────┘
```

**Ready shelf:** `border-b border-[#1a1a1a] pb-6 mb-6`. Label: "Ready to Start" in `text-[#888] text-xs uppercase tracking-widest`. Cards in horizontal scroll row.

**Kanban columns:** Equal-width flex columns. Column header: `text-[#888] text-xs uppercase tracking-widest mb-3`. Column body: vertical card stack, `gap-2`.

---

## Project Card

```
┌──────────────────────────────────────────────┐
│  ● running                          Research │
│                                              │
│  My Fintech App                              │
│  Agent building market analysis...           │
│                                              │
│  2 min ago               [View Logs]         │
└──────────────────────────────────────────────┘
```

- Container: `bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4`
- Hover: `border-[#333] transition-colors duration-150`
- Blocked state: `border-[#ef4444]` (red border, not just badge)
- Status badge: colored dot + text, `text-[11px] font-medium`
- Phase label: `text-[#555] text-[11px]` top-right
- Project name: `text-white text-[14px] font-medium`
- Activity line: `text-[#888] text-[12px]`
- Timestamp + action: `text-[#555] text-[11px]` bottom row

---

## Status Badges

```tsx
// Dot + label pattern
<span className="flex items-center gap-1.5 text-[11px] font-medium">
  <span className="w-1.5 h-1.5 rounded-full bg-[--status-running]" />
  running
</span>
```

| Status | Dot color | Text color |
|--------|-----------|------------|
| ready | `#3b82f6` | `#3b82f6` |
| running | `#22c55e` | `#22c55e` |
| blocked | `#ef4444` | `#ef4444` |
| queued | `#f59e0b` | `#f59e0b` |
| awaiting approval | `#a855f7` | `#a855f7` |
| failed | `#ef4444` | `#ef4444` |

---

## Ticket Creation Page (`/projects/new`)

```
┌─ Sidebar ──┬─────────────────────────────────────────────────────┐
│            │  ← Back     New Project                             │
│            │  ─────────────────────────────────────────────────  │
│            │                                                      │
│            │  ┌─── Chat (flex-1) ──────┬── Context Panel (320px)┐│
│            │  │                        │                         ││
│            │  │  [agent]               │  index.md               ││
│            │  │  Hey! I looked at your │  ─────────────          ││
│            │  │  idea...               │  project-context.md     ││
│            │  │                        │  ideation/              ││
│            │  │  [user]                │    niches.md  ●new      ││
│            │  │  Solo freelancers...   │    research.md          ││
│            │  │                        │                         ││
│            │  │  [agent typing...]     │                         ││
│            │  │                        │                         ││
│            │  ├────────────────────────┤                         ││
│            │  │ [input          ] Send │                         ││
│            │  └────────────────────────┴─────────────────────────┘│
│            │                         [Create Ticket]              │
└────────────┴─────────────────────────────────────────────────────┘
```

**Chat column:** `flex-1 flex flex-col`. Messages scroll area, composer pinned bottom.

**Agent message:** `bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 max-w-[80%]`. Self-aligned left.

**User message:** `bg-[#111] rounded-lg p-4 max-w-[80%]`. Self-aligned right.

**Typing indicator:** Three animated dots, `bg-[#555]`, staggered opacity pulse.

**Context panel:** `w-[320px] border-l border-[#1a1a1a] p-4`. File tree list. New files show a blue `●new` dot. Clicking a file opens it in a slide-over.

**Composer:** `border-t border-[#1a1a1a] p-4`. Input: `bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg`. Send button: ghost until input has text, then `text-white`.

**Create Ticket button:** Fixed bottom-right of page. `bg-white text-black font-medium px-4 py-2 rounded-lg`. Disabled + spinner while context build runs.

---

## Approvals Page (`/approvals`)

```
┌─ Sidebar ──┬─────────────────────────────────────────────────────┐
│            │  Approvals                          3 pending        │
│            │  ─────────────────────────────────────────────────  │
│            │                                                      │
│            │  ┌──────────────────────────────────────────────┐   │
│            │  │  SEO: Update meta tags on /pricing            │   │
│            │  │  My Fintech App · Maintain · 2h ago           │   │
│            │  │                                               │   │
│            │  │  Agent wants to update title + description    │   │
│            │  │  on 3 pages. PageSpeed score: 62 → 78.        │   │
│            │  │                                               │   │
│            │  │  [View PR ↗]   [Approve]   [Reject]          │   │
│            │  └──────────────────────────────────────────────┘   │
│            │                                                      │
│            │  ┌──────────────────────────────────────────────┐   │
│            │  │  ...                                          │   │
│            │  └──────────────────────────────────────────────┘   │
└────────────┴─────────────────────────────────────────────────────┘
```

**Approval card:** `bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-5`.

**Action buttons:**
- View PR: ghost, `text-[#888] hover:text-white`
- Approve: `bg-white text-black text-sm font-medium px-3 py-1.5 rounded-md`
- Reject: ghost, `text-[#888] hover:text-[#ef4444]`

---

## Settings Page (`/settings`)

Standard form layout. Left: nav (API Keys, Platform, Account). Right: form content.

**Input fields:** `bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2 text-white text-sm`. Focus: `border-white outline-none`.

**Secret fields:** Masked by default. Show/hide toggle icon right-side of input.

**Save button:** `bg-white text-black` primary. Always bottom of form section.

---

## Toast Notifications

Top-right, stacked. `fixed top-4 right-4 z-50`.

```
┌───────────────────────────────┐
│  ● Building context...    [×] │  ← loading (spinner dot)
└───────────────────────────────┘

┌───────────────────────────────┐
│  ✓ Ticket created             │  ← success (green dot)
└───────────────────────────────┘

┌───────────────────────────────┐
│  ⚠ Agent blocked: API key     │  ← error (red dot)
│  required for Reddit API  [→] │
└───────────────────────────────┘
```

Container: `bg-[#111] border border-[#1a1a1a] rounded-lg px-4 py-3 shadow-lg`.
Text: `text-white text-sm`. Auto-dismiss: 4s (errors stay until dismissed).

---

## Buttons

| Variant | Style |
|---------|-------|
| Primary | `bg-white text-black font-medium px-4 py-2 rounded-lg hover:bg-[#e5e5e5]` |
| Ghost | `text-[#888] hover:text-white hover:bg-[#111] px-3 py-1.5 rounded-md` |
| Destructive | `text-[#ef4444] hover:bg-[#ef444410] px-3 py-1.5 rounded-md` |
| Icon | `w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#111]` |

All transitions: `transition-colors duration-150`.

---

## Animation Guidelines

- **Duration:** 150ms micro (hover/focus), 200ms transitions (card state change, toast in), 300ms page elements
- **Easing:** `ease-out` for entering, `ease-in` for exiting
- **Toast:** slide in from right + fade, slide out to right + fade
- **Card state change:** border color transition only — no layout animation
- **Typing indicator:** staggered opacity pulse, 600ms cycle
- **Context panel file appear:** fade in, 150ms
- Respect `prefers-reduced-motion` — disable all animations

---

## shadcn/ui Config

`components.json`:
```json
{
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "baseColor": "zinc",
    "cssVariables": true
  }
}
```

Override shadcn defaults with the color tokens above via `globals.css`. Dark mode only — no light mode toggle.

---

## Geist Font Setup

```tsx
// src/app/layout.tsx
import { Geist, Geist_Mono } from "next/font/google"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
```

JetBrains Mono for log/code panels via `next/font/google` — `JetBrains_Mono`.

---

## Do / Don't

| Do | Don't |
|----|-------|
| 1px borders, `#1a1a1a` | Thick borders or colored borders (except blocked cards) |
| Status dot + text badge | Filled pill badges with bg color |
| `text-[#888]` for secondary info | Light gray on dark gray (check contrast) |
| Lucide icons, 16px, consistent stroke | Mixed icon sets or emoji |
| Hover `border-[#333]` on cards | Box shadows on dark surfaces |
| White primary button | Colored primary buttons |
| Skeleton loaders for >300ms waits | Spinner-only for full page loads |
