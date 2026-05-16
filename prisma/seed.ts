import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import bcrypt from "bcryptjs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

const DEMO_PROJECT_NAME = "MealPlanner.ai"

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env")
  }
  const hash = await bcrypt.hash(password, 12)
  const user = await db.user.upsert({
    where: { email },
    update: { password: hash },
    create: { email, password: hash },
  })
  console.log(`Seeded admin user: ${user.email}`)
}

async function writeArtifacts(s3Prefix: string) {
  const base = path.resolve(process.cwd(), s3Prefix)
  await mkdir(path.join(base, "research"), { recursive: true })

  await writeFile(
    path.join(base, "brief.md"),
    `# Brief: MealPlanner.ai

## Problem
Busy professionals struggle to plan healthy meals around tight schedules and dietary preferences.

## Target user
Knowledge workers aged 25–40 in urban areas, cooking at home 3–5 nights a week, with one or more dietary constraints (vegetarian, gluten-free, high-protein).

## Solution
An AI meal planner that ingests pantry inventory, dietary rules, and weekly schedule, then outputs a 7-day plan with shopping list and prep windows.

## Success metrics
- Weekly active users
- Plans-per-user/week ≥ 1
- Grocery list adoption rate

## Out of scope
- Restaurant recommendations
- Calorie tracking (integrate with HealthKit instead)
`
  )

  await writeFile(
    path.join(base, "research", "findings.md"),
    `# Research Findings — MealPlanner.ai

## Market size
US meal planning app market: $1.2B (2025), projected $2.4B by 2030 (Grand View). Adjacent grocery delivery $97B.

## Differentiation
Three incumbents dominate (Mealime, PlateJoy, Eat This Much). All optimize for diet-first input; none start from pantry inventory. Pantry-first reduces grocery waste — primary unmet need per Reddit r/MealPrepSunday survey.

## Distribution
- SEO long-tail: "[diet] meal plan with [ingredient]"
- TikTok recipe creators as affiliate channel
- B2B2C: corporate wellness platforms (Wellable, Virgin Pulse)

## Risks
- LLM-generated recipes hallucinate cook times. Mitigation: validation layer against USDA database.
- Recipe IP claims from existing publishers. Mitigation: original prompts, no scraping.
`
  )

  await writeFile(
    path.join(base, "research", "competitor-matrix.md"),
    `# Competitor Matrix

| Product | Price | Pantry-first | Dietary rules | Grocery integration |
|---|---|---|---|---|
| Mealime | Free + $6/mo | No | Yes | Instacart |
| PlateJoy | $13/mo | No | Yes | Multiple |
| Eat This Much | Free + $5/mo | Limited | Yes | Limited |
| **MealPlanner.ai** | **$8/mo (planned)** | **Yes** | **Yes** | **Instacart + Amazon Fresh** |
`
  )

  await writeFile(
    path.join(base, "research", "citations.md"),
    `# Citations

- Grand View Research — US Meal Kit Market Report 2025: https://www.grandviewresearch.com/industry-analysis/meal-kit-delivery-services-market
- Mealime feature comparison: https://www.mealime.com/pricing
- PlateJoy review: https://www.healthline.com/nutrition/platejoy-review
- r/MealPrepSunday — Top 100 posts of 2025 (pain points): https://reddit.com/r/MealPrepSunday/top
- Wellable corporate wellness platform overview: https://www.wellable.co/blog/corporate-wellness-platforms
`
  )

  await writeFile(
    path.join(base, "index.md"),
    `# Context Index

- brief.md
- research/findings.md
- research/competitor-matrix.md
- research/citations.md
- log.md
`
  )

  await writeFile(
    path.join(base, "log.md"),
    `# Activity Log

- ticket-context-build: complete (12 msgs)
- research: complete (4 sections, 12 citations)
`
  )
}

async function seedDemoProject() {
  const existing = await db.project.findFirst({ where: { name: DEMO_PROJECT_NAME } })
  if (existing) {
    console.log(`Demo project already exists: ${existing.id}`)
    await writeArtifacts(existing.s3Prefix)
    return
  }

  const project = await db.project.create({
    data: {
      name: DEMO_PROJECT_NAME,
      description: "AI meal planning for busy professionals — pantry-first, dietary-aware",
      status: "MAINTAIN",
      s3Prefix: "",
    },
  })
  const s3Prefix = `projects/${project.id}`
  await db.project.update({ where: { id: project.id }, data: { s3Prefix } })

  const ticketJob = await db.job.create({
    data: {
      projectId: project.id,
      phase: "TICKET_CONTEXT_BUILD",
      status: "COMPLETE",
    },
  })

  const researchJob = await db.job.create({
    data: {
      projectId: project.id,
      phase: "RESEARCH",
      status: "COMPLETE",
    },
  })

  await db.jobEvent.createMany({
    data: [
      {
        jobId: ticketJob.id,
        type: "complete",
        message: "Context build complete — 5 sections drafted",
      },
      {
        jobId: researchJob.id,
        type: "progress",
        message: "Searching market sizing data via Tavily",
      },
      {
        jobId: researchJob.id,
        type: "progress",
        message: "Wrote research/findings.md (4 sections)",
      },
      {
        jobId: researchJob.id,
        type: "complete",
        message: "Research complete — 4 sections, 12 citations",
      },
    ],
  })

  await db.approval.create({
    data: {
      projectId: project.id,
      jobId: researchJob.id,
      title: "SEO PR: JSON-LD Recipe schema + dynamic meta tags",
      description:
        "Adds schema.org Recipe markup to /recipes/[slug] and dynamic <title>/<meta description> tags driven by recipe content.\n\nBranch: seo/recipe-schema\nDiff: +127 -8 across 4 files",
      type: "SEO_PR",
      status: "PENDING",
      metadata: { branch: "seo/recipe-schema", diff: "+127 -8" },
    },
  })

  await writeArtifacts(s3Prefix)

  console.log(`Seeded demo project: ${project.id} (${DEMO_PROJECT_NAME})`)
}

async function main() {
  await seedAdmin()
  await seedDemoProject()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
    await pool.end()
  })
