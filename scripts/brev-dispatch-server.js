#!/usr/bin/env node
/**
 * AppForge agent dispatch server — runs on the Brev GPU instance.
 *
 * POST /dispatch   Authorization: Bearer <DISPATCH_SECRET>
 *   Body: { jobId, phase, prompt, env }
 *   → spawns openclaw agent in background, returns immediately
 *
 * GET  /health     → { ok: true }
 */

"use strict"

const http = require("http")
const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")

const PORT   = parseInt(process.env.DISPATCH_PORT || "18789", 10)
const SECRET = process.env.DISPATCH_SECRET || ""

if (!SECRET) {
  console.error("DISPATCH_SECRET env var is required")
  process.exit(1)
}

// MCP servers enabled per phase
const PHASE_MCP = {
  TICKET_CONTEXT_BUILD: ["filesystem", "bash"],
  RESEARCH:             ["filesystem", "bash", "tavily"],
  GENERATION:           ["filesystem", "bash", "github"],
  MAINTAIN_SEO:         ["filesystem", "bash", "playwright", "github"],
  MAINTAIN_AEO:         ["filesystem", "bash", "playwright", "github"],
  MAINTAIN_INCIDENT:    ["filesystem", "bash", "github"],
}

function buildRunScript(jobId, phase, promptFile, workspacePath, env) {
  const contextPath = path.join(workspacePath, "context")
  const enabledMcps = PHASE_MCP[phase] || ["filesystem", "bash"]

  // All env vars exported at the top — safe to reference as $VAR throughout the script
  const envExports = Object.entries(env)
    .map(([k, v]) => `export ${k}=${shellEscape(String(v))}`)
    .join("\n")

  // MCP set commands — use double-quoted JSON so bash expands $VAR inside
  const mcpLines = []
  if (enabledMcps.includes("filesystem")) {
    mcpLines.push(
      `openclaw mcp set filesystem '{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","${contextPath}"]}'`
    )
  }
  if (enabledMcps.includes("bash")) {
    mcpLines.push(`openclaw mcp set bash '{"command":"npx","args":["-y","mcp-shell"]}'`)
  }
  if (enabledMcps.includes("tavily")) {
    mcpLines.push(
      `openclaw mcp set tavily "{\\"command\\":\\"npx\\",\\"args\\":[\\"--yes\\",\\"tavily-mcp\\"],\\"env\\":{\\"TAVILY_API_KEY\\":\\"$TAVILY_API_KEY\\"}}"`
    )
  }
  if (enabledMcps.includes("github")) {
    mcpLines.push(
      `openclaw mcp set github "{\\"command\\":\\"npx\\",\\"args\\":[\\"--yes\\",\\"@modelcontextprotocol/server-github\\"],\\"env\\":{\\"GITHUB_PERSONAL_ACCESS_TOKEN\\":\\"$GITHUB_TOKEN\\"}}"`
    )
  }
  if (enabledMcps.includes("playwright")) {
    mcpLines.push(
      `openclaw mcp set playwright '{"command":"npx","args":["-y","@executeautomation/mcp-playwright"]}'`
    )
  }

  return `#!/bin/bash
set -e

${envExports}

_cleanup() {
  local code=$?
  aws s3 sync "${contextPath}/" "s3://$S3_BUCKET_NAME/$S3_PREFIX/" --quiet 2>/dev/null || true
  if [ "$code" -eq 0 ]; then
    curl -sf -X POST "$APPFORGE_CALLBACK_URL/api/jobs/$JOB_ID/events" \\
      -H "Authorization: Bearer $JOB_TOKEN" \\
      -H "Content-Type: application/json" \\
      -d '{"type":"complete","message":"Agent phase complete"}' || true
  else
    curl -sf -X POST "$APPFORGE_CALLBACK_URL/api/jobs/$JOB_ID/events" \\
      -H "Authorization: Bearer $JOB_TOKEN" \\
      -H "Content-Type: application/json" \\
      -d "{\\"type\\":\\"error\\",\\"message\\":\\"Agent exited with code $code\\"}" || true
  fi
}
trap _cleanup EXIT

# Configure openclaw model (Nemotron via NVIDIA NIM)
openclaw config patch --stdin <<'OCCONFIG'
{
  "models": {
    "providers": {
      "nvidia": {
        "baseUrl": "https://integrate.api.nvidia.com/v1",
        "models": [
          {
            "id": "nvidia/nemotron-3-super-120b-a12b",
            "name": "Nemotron 3 Super 120B",
            "api": "openai-completions"
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": "nvidia/nemotron-3-super-120b-a12b"
    }
  }
}
OCCONFIG

# Patch NVIDIA API key separately (avoids heredoc variable expansion issues)
openclaw config set models.providers.nvidia.apiKey "$NVIDIA_API_KEY"

# Configure MCP servers for this phase
${mcpLines.join("\n")}

# Sync S3 context to local workspace
mkdir -p "${contextPath}"
aws s3 sync "s3://$S3_BUCKET_NAME/$S3_PREFIX/" "${contextPath}/" --quiet || true

# Run agent — EXIT trap handles complete/error callback and S3 sync back
openclaw agent --local --session-id "${jobId}" --message "$(cat '${promptFile}')"
`
}

/** Single-quote escape a value for safe shell export. */
function shellEscape(val) {
  return "'" + val.replace(/'/g, "'\\''") + "'"
}

function handleRequest(req, res) {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (req.method !== "POST" || req.url !== "/dispatch") {
    res.writeHead(404).end("Not found")
    return
  }

  const auth = req.headers["authorization"] || ""
  if (auth !== `Bearer ${SECRET}`) {
    res.writeHead(401).end("Unauthorized")
    return
  }

  let body = ""
  req.on("data", (chunk) => (body += chunk))
  req.on("end", () => {
    let data
    try {
      data = JSON.parse(body)
    } catch {
      res.writeHead(400).end("Bad JSON")
      return
    }

    const { jobId, phase, prompt, env } = data
    if (!jobId || !prompt) {
      res.writeHead(400).end("Missing jobId or prompt")
      return
    }

    const workspacePath = path.join("/workspace", "jobs", jobId)
    const promptFile    = path.join(workspacePath, "prompt.md")
    const scriptFile    = path.join(workspacePath, "run.sh")
    const logFile       = path.join(workspacePath, "agent.log")

    try {
      fs.mkdirSync(path.join(workspacePath, "context"), { recursive: true })
      fs.writeFileSync(promptFile, prompt, "utf-8")
      fs.writeFileSync(
        scriptFile,
        buildRunScript(jobId, phase, promptFile, workspacePath, env || {}),
        { mode: 0o755 }
      )
    } catch (err) {
      console.error(`[${jobId}] Failed to write job files:`, err)
      res.writeHead(500).end("Failed to create job workspace")
      return
    }

    // Respond immediately — agent runs in background
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, jobId }))

    const logFd = fs.openSync(logFile, "a")
    const child = spawn("bash", [scriptFile], {
      detached: true,
      stdio: ["ignore", logFd, logFd],
    })
    child.unref()
    fs.closeSync(logFd)

    console.log(
      `[${new Date().toISOString()}] Dispatched ${phase} job=${jobId} pid=${child.pid}`
    )
  })
}

const server = http.createServer(handleRequest)
server.listen(PORT, "0.0.0.0", () => {
  console.log(`AppForge dispatch server listening on port ${PORT}`)
})
