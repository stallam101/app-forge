import { mkdir, readFile, writeFile, readdir, stat } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

const PROJECTS_DIR = join(process.cwd(), "projects")

function projectDir(projectId: string): string {
  return join(PROJECTS_DIR, projectId)
}

export async function seedProjectContext(
  projectId: string,
  name: string,
  description: string
): Promise<void> {
  const dir = projectDir(projectId)
  await mkdir(dir, { recursive: true })
  await mkdir(join(dir, "ideation"), { recursive: true })
  await mkdir(join(dir, "generation"), { recursive: true })
  await mkdir(join(dir, "maintain"), { recursive: true })

  const brief = `# ${name}\n\n${description}\n`

  const platformConstraints = `# Platform Constraints — Vercel

## Supported
- Next.js, React, Vue, Svelte, Angular (static + SSR)
- Serverless functions: Node.js, Python, Edge Runtime
- Vercel Postgres (Neon), Vercel Blob, Vercel KV (Upstash Redis)
- Cron jobs via vercel.json

## Not Supported — Do Not Plan or Build
- Long-running background workers or daemons
- Native WebSocket servers (use Ably, Pusher, or polling)
- Custom Docker runtimes
- Persistent local disk writes
- Self-hosted databases or caches
`

  const projectContext = `# ${name} — Context

## What We're Building
${description}

## Tech Stack
TBD — determined during ideation.

## Feature Scope (MVP)
TBD — determined during ideation.

## Current State
Phase: BACKLOG
GitHub: —
Deployment: —

## Known Issues / Tech Debt
None yet.

## Decision Log
(empty)
`

  const index = `# ${name} — Index

## Always load
- \`project-context.md\` — current project state | load every run
- \`platform-constraints.md\` — hard hosting limits | load before any code

## Raw sources (immutable)
- \`brief.md\` — original user input | load if unclear on intent
`

  const log = `# ${name} — Log\n`

  await Promise.all([
    writeFile(join(dir, "brief.md"), brief),
    writeFile(join(dir, "platform-constraints.md"), platformConstraints),
    writeFile(join(dir, "project-context.md"), projectContext),
    writeFile(join(dir, "index.md"), index),
    writeFile(join(dir, "log.md"), log),
  ])
}

export async function readContextFile(
  projectId: string,
  filePath: string
): Promise<string | null> {
  const fullPath = join(projectDir(projectId), filePath)
  if (!existsSync(fullPath)) return null
  return readFile(fullPath, "utf-8")
}

export async function writeContextFile(
  projectId: string,
  filePath: string,
  content: string
): Promise<void> {
  const fullPath = join(projectDir(projectId), filePath)
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"))
  await mkdir(dir, { recursive: true })
  await writeFile(fullPath, content)
}

export async function appendContextFile(
  projectId: string,
  filePath: string,
  content: string
): Promise<void> {
  const fullPath = join(projectDir(projectId), filePath)
  const existing = existsSync(fullPath) ? await readFile(fullPath, "utf-8") : ""
  await writeFile(fullPath, existing + content)
}

export async function listContextFiles(projectId: string): Promise<string[]> {
  const dir = projectDir(projectId)
  if (!existsSync(dir)) return []
  return listFilesRecursive(dir, dir)
}

async function listFilesRecursive(baseDir: string, currentDir: string): Promise<string[]> {
  const entries = await readdir(currentDir)
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(currentDir, entry)
    const s = await stat(fullPath)
    if (s.isDirectory()) {
      const subFiles = await listFilesRecursive(baseDir, fullPath)
      files.push(...subFiles)
    } else {
      files.push(fullPath.replace(baseDir + "/", ""))
    }
  }

  return files
}

export async function getProjectContextBundle(projectId: string): Promise<string> {
  const coreFiles = ["platform-constraints.md", "index.md", "project-context.md"]
  const sections: string[] = []

  for (const file of coreFiles) {
    const content = await readContextFile(projectId, file)
    if (content) {
      sections.push(`--- ${file} ---\n${content}`)
    }
  }

  return sections.join("\n\n")
}
