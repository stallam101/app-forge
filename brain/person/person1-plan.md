# Person 1 — Brev / OpenClaw / Nemotron (Plan)

> **Owner:** Person 1 — prize-eligibility unlock for the NVIDIA / ASUS / Baskin Cloud Track.
> **Goal:** Stand up a Brev.dev GPU instance with OpenClaw, Nemotron 3 Super 120B, and live tool use (Tavily web search, file write, fetch), wrapped in an HTTP server on `:8080` that AppForge POSTs to.
> **Scope:** Infrastructure + agent harness. Person 2 owns the AppForge-side dispatcher; Person 3 owns the UI that renders agent output; Person 4 owns demo glue.

## 1. Requirements Restatement

Without P1's work nothing else is eligible:

- Compute MUST run on a Brev.dev instance (Cloud Track gate).
- Harness MUST be OpenClaw (no custom agent loops).
- LLM MUST be Nemotron 3 Super 120B served via `https://integrate.api.nvidia.com/v1` (build.nvidia.com).
- Agent MUST demonstrate live tool use — minimum `web_search` (Tavily) + `file_write`.
- Agent MUST run independently end-to-end during the demo — no human in the loop while it executes.
- Deliverable is a live URL, not a slideshow.

## 2. Deliverables (by min 30)

1. `BREV_AGENT_URL` shared in team channel — public URL of the wrapper.
2. `NVIDIA_API_KEY` shared and pasted into local `.env` files.
3. `TAVILY_API_KEY` shared.
4. Screenshot of a successful Nemotron research run hitting AppForge's callback endpoint.
5. Confirmed event types match `STATUS_MAP` in AppForge: `progress | blocker | approval_request | complete | error`.

## 3. File-by-File Spec (Brev-side, lives on the instance — NOT in this repo)

### 3.1 `configs/research.openclaw.json`

OpenClaw phase config pointing at `https://integrate.api.nvidia.com/v1` with Nemotron 3 Super 120B as the model and these tools enabled:

```json
{
  "model": "nvidia/nemotron-3-super-120b",
  "baseUrl": "https://integrate.api.nvidia.com/v1",
  "apiKeyEnv": "NVIDIA_API_KEY",
  "tools": [
    { "type": "web_search", "provider": "tavily", "apiKeyEnv": "TAVILY_API_KEY" },
    { "type": "file_write", "root": "./projects/{PROJECT_ID}" },
    { "type": "fetch" }
  ],
  "maxSteps": 40,
  "temperature": 0.4
}
```

Reference: `nvidia.com/clawhelp` is the source of truth.

### 3.2 HTTP wrapper on `:8080`

Tiny Express/Fastify/Hono server. One route:

```
POST /run
Headers (optional): Authorization: Bearer ${BREV_AGENT_SECRET}
Body: {
  jobId: string,
  phase: "TICKET_CONTEXT_BUILD" | "RESEARCH",
  projectId: string,
  callbackUrl: string,        // AppForge base URL (e.g. ngrok)
  callbackToken: string,      // the job.jobToken — echo on every callback
  brief: string,              // project brief text
  openclawConfig: string,     // full config JSON as string
  agentPrompt: string,        // interpolated prompt
  env: { NVIDIA_API_KEY, NVIDIA_BASE_URL, TAVILY_API_KEY }
}
Response: 200 { ok: true, runId: string }
```

Behavior:
1. Validate body. Reject malformed payloads with 400.
2. Spawn OpenClaw as a background process with the supplied config + prompt + env. Do NOT block the response on agent completion.
3. Return `{ ok: true, runId }` within 5s (AppForge's `dispatchToBrev` enforces a 10s `AbortSignal.timeout`).
4. While the agent runs, on each meaningful step post a callback to:

```
POST {callbackUrl}/api/jobs/{jobId}/events
Authorization: Bearer {callbackToken}
Body: { type: "progress" | "blocker" | "approval_request" | "complete" | "error",
        message: string,
        metadata?: object }
```

### 3.3 Event taxonomy (contract with P2 + P3)

Required types — anything else AppForge silently inserts as an event but doesn't move the job status:

| Type | When | Job status side-effect |
|---|---|---|
| `progress` | Each step / tool use / write | None (job stays RUNNING) |
| `blocker` | Need user input that we can't supply mid-run | Job → BLOCKED |
| `approval_request` | Phase boundary requires human sign-off | Job → AWAITING_APPROVAL |
| `complete` | Run succeeded | Job → COMPLETE |
| `error` | Run failed | Job → FAILED |

Useful optional metadata fields P3 will render:
- On `progress` from a tool: `{ tool: "web_search", query: "..." }` or `{ tool: "file_write", path: "research/findings.md" }`
- On `progress` when a file is written: `{ artifact: "research/findings.md" }` — triggers P3 to re-fetch artifact content
- On `complete`: `{ artifacts: [{path, preview?}], citations: [{url, title?}], summary: string }`

### 3.4 Storage layout

Agent writes to `./projects/{projectId}/` on the Brev instance. AppForge reads via `src/lib/s3.ts` `getS3Object()`, which falls back to local FS at the same path. Use S3 if `AWS_*` env is set on the Brev instance, else just write local — same wiki layout either way.

Standard files the Research agent should produce:
- `brief.md` (already from ticket-context-build; not Research)
- `research/findings.md`
- `research/competitors.md` (or `competitor-matrix.md`)
- `research/market-analysis.md`
- `research/tech-stack.md`
- `research/monetization.md`
- `research/citations.md`

## 4. Timeline (60 min)

| Min | Task |
|---|---|
| 0–10 | Provision Brev instance, install OpenClaw per `nvidia.com/clawhelp`, paste NVIDIA_API_KEY |
| 10–25 | Wire Nemotron + Tavily; smoke test a hand-written research prompt; verify model returns + tool calls |
| 25–40 | HTTP wrapper on `:8080`; expose port publicly; share `BREV_AGENT_URL`; first end-to-end POST from a curl |
| 40–50 | Tighten event payloads (metadata for artifacts, citations, summary) with P2 + P3 |
| 50–60 | Merge support if needed; pre-warm one demo run for the demo |

## 5. Risks & Mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| Brev provisioning slow | HIGH | Start at min 0; if not ready by min 20, switch to a fallback GCP A100 with the same harness (acceptable per Cloud Track) |
| `nvidia.com/clawhelp` docs ambiguous | HIGH | Allocate min 10–25 specifically for trial-and-error; lean on NVIDIA Discord if blocked |
| Nemotron 3 Super 120B rate-limited / queue depth | MED | Pre-warm a session at min 50; have a cached run ready as last-resort fallback per cut-list |
| Tavily API quota | LOW | Free tier covers a single demo; if exceeded, fall back to `fetch` tool with curated URLs |
| Callback URL not reachable from Brev | HIGH | AppForge runs locally → ngrok the laptop → paste ngrok URL into the `callbackUrl` AppForge sends in the body. Verify reachability from Brev shell before min 30. |

## 6. Coordination Touchpoints

| Min | With | What |
|---|---|---|
| 0 | P2 | Confirm request body shape, response shape, auth header preference (skip `BREV_AGENT_SECRET` unless needed) |
| 10 | P2 | Hand over `BREV_AGENT_URL` even if agent loop isn't fully wired — lets P2 verify dispatch path with mock OpenClaw |
| 25 | P3 | Lock event `metadata` field names so research-view renders artifacts immediately |
| 40 | All | Pre-warm one research run; capture timing for the demo script |

## 7. Definition of Done

- [ ] Brev instance provisioned, OpenClaw running, `:8080` reachable from the public internet
- [ ] `POST /run` accepts AppForge's payload and returns `{ok: true, runId}` within 5s
- [ ] Agent posts at least one `progress` event back to the callback URL within 10s of dispatch
- [ ] At least one `web_search` and one `file_write` tool call observable in the run
- [ ] Final `complete` event written; AppForge's Job row reaches `status = COMPLETE`
- [ ] Demo-ready: a pre-warmed `RESEARCH` run completes end-to-end during a dry run

## 8. Cut List (if behind at min 40)

1. Cut S3 entirely; local FS only on Brev.
2. Cut `fetch` tool; web_search + file_write are minimum-viable for eligibility.
3. Cut `BREV_AGENT_SECRET` auth header; rely on URL obscurity for the demo.
4. Cut `TICKET_CONTEXT_BUILD` agent path; let AppForge fall back to its existing in-process Claude flow (P2 still routes RESEARCH to Brev).
5. **Never cut:** Nemotron + at least one tool call + a `complete` callback. That's the eligibility floor.
