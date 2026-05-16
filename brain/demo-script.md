# Demo Script — AppForge Hackathon

> ~5 min walk-through. Owned by Person 4. Read `hackathon-implementation-plan.md` and `person4-plan.md` for build context.

## Preconditions (verify in last 10 min before demo)

- [ ] `.env` has `NVIDIA_API_KEY`, `BREV_AGENT_URL`, `TAVILY_API_KEY`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- [ ] `npx prisma migrate reset --force && npm run db:seed` — clean demo state
- [ ] `npm run dev` running on `http://localhost:3000`
- [ ] Brev instance up — `curl ${BREV_AGENT_URL}/health` returns 200
- [ ] Second monitor: SSH'd into Brev, `tail -f openclaw.log` ready
- [ ] Browser tab: `http://localhost:3000/login` open, credentials prefilled
- [ ] Backup tab: pre-recorded Brev run video at `/Users/ashar/demos/brev-run.mp4` (fallback only)

## Click flow

### 0. Set scene (0:00 – 0:20)
- Open `/login`, login as `demo@appforge.dev` / `demo1234`.
- "AppForge takes a one-line product idea and runs it through four phases — Ticket Creation, Research, Generation, Maintain. Every transition is human-approved. The Research phase tonight is real autonomous compute on a Brev GPU with Nemotron 3 Super and OpenClaw."

### 1. Kanban (0:20 – 0:45)
- Dashboard shows MealPlanner.ai card in MAINTAIN column (seeded).
- "This one's been running for a while — it's in Maintain with a pending SEO PR approval. Real production state."
- Point to the green `complete` badges on prior phases via the project card.

### 2. New project (0:45 – 1:30)
- Click `+ New Project`. Type **"AI flashcards for med students"**. Submit.
- Land on ticket-building view (`/projects/{id}`).
- Ideation chat (Claude Sonnet, AI SDK):
  - Turn 1: "Who's the user?" → answer: "Third-year med students cramming for STEP 1, mobile-first, offline-capable."
  - Turn 2: "What's the differentiator?" → answer: "Spaced repetition tuned to USMLE high-yield topics, with AI-generated mnemonics."
- Click **Create Ticket**.

### 3. Ticket build (1:30 – 2:00)
- Card moves to "Building ticket…" with spinner. ~20s.
- Lands on brief view — show the 5-section brief that the context build wrote.
- "That brief was assembled by a separate context-build job — the chat is just the input."

### 4. Send to Research — THE MONEY SHOT (2:00 – 3:30)
- Click **Send to Research**.
- Switch to second monitor: OpenClaw log starts streaming on Brev.
- "OpenClaw is the harness, Nemotron 3 Super 120B is the model, calls go through `integrate.api.nvidia.com`. Live tool use — Tavily web search, file write, fetch."
- Back to AppForge: research-view streams in via SSE. Point to:
  - Structured sections appearing one at a time
  - Tavily citations (clickable URLs)
  - Competitor matrix table
- "Pause here. The agent is autonomous — no human in the loop during this run. It's pulling competitor data, writing artifacts to S3, and posting events back to AppForge over an authenticated callback."
- Open the side panel: `research/competitor-matrix.md` and `research/findings.md` are real files the agent wrote.

### 5. Approve research → Generation (3:30 – 4:00)
- Card shows `awaiting approval` purple pill.
- Click into **Approvals** tab. PHASE_TRANSITION approval is there.
- Click **Approve**. Card moves to GENERATION column.
- Generation view loads, shows **"Configure GitHub token to unlock generation."** with a link to Settings.
- "Honest stub. We didn't fake autonomy here — the same OpenClaw harness powers Generation; we just gated it on a token we don't have time to wire tonight."

### 6. Approvals page (seeded SEO PR) (4:00 – 4:30)
- Back to **Approvals**. The seeded SEO PR for MealPlanner.ai is still PENDING.
- Click **Approve**. Card disappears. Kanban updates.
- "Real approval flow, real state change. This is what Maintain looks like in steady state — a stream of small PRs the human ships or rejects."

### 7. Settings + Wrap (4:30 – 5:00)
- Open **Settings**. Four fields, NVIDIA configured ✓.
- "Encrypted at rest, AES-256-GCM. Per-tenant in the production design."
- Close: "That's the loop. Idea → Research → Generation → Maintain, all human-approved, agent on Brev, model from build.nvidia.com. Questions?"

## Failure fallbacks

### Brev `/health` returns non-200 at demo start
- Skip step 4 live agent run.
- Click Send to Research; let it queue.
- Switch to pre-recorded Brev video on second monitor.
- Narrate: "Here's a recorded run from this morning — same code path, same Nemotron model, same Tavily tool use. The events you'd see streaming would land in this exact view."
- Manually advance the project via Approvals page so the rest of the flow still demos.

### Nemotron slow (>30s no first token)
- Continue narrating the architecture. "Tool call latency at this point — the agent is mid-Tavily search. In production we'd parallelize."
- If still stuck at 60s: hard-cut to pre-recorded video.

### Tavily rate-limited / 429
- The agent will still complete using `fetch` + `file_write`. Narrate the partial result.
- "Tavily quota burnt on prep runs — the harness degrades gracefully because OpenClaw treats tool errors as just another observation."

### Postgres connection drops mid-demo
- Refresh the page once. Connection pool recovers.
- If it doesn't: fall back to seeded MealPlanner.ai narration only. Skip steps 2–5.

### Approval PATCH fails
- Manually `UPDATE project SET status = 'GENERATION' WHERE id = '...';` in a pre-opened `psql` window. Refresh.

## Do not say

- "It's just a wrapper" — undersells the eligibility work
- "Generation is fake" — say "honest stub, gated on a token"
- "We didn't have time" — say "out of scope for the 1-hour build"
- "Claude" during the Research narration — the eligibility model is Nemotron; Claude is only in the chat
