import { chromium } from "@playwright/test"

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const errors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
  })

  // 1. Login page
  console.log("\n=== PAGE 1: LOGIN ===")
  await page.goto("http://localhost:3000/login")
  await page.waitForLoadState("networkidle")
  await page.screenshot({ path: "/tmp/appforge-login.png", fullPage: true })
  console.log("Screenshot: /tmp/appforge-login.png")

  // Check login form exists
  const emailInput = await page.locator('input[type="email"]').count()
  const passwordInput = await page.locator('input[type="password"]').count()
  const signInBtn = await page.locator('button[type="submit"]').count()
  console.log(`Email input: ${emailInput > 0 ? "OK" : "MISSING"}`)
  console.log(`Password input: ${passwordInput > 0 ? "OK" : "MISSING"}`)
  console.log(`Sign in button: ${signInBtn > 0 ? "OK" : "MISSING"}`)

  // Login
  await page.fill('input[type="email"]', "admin@appforge.dev")
  await page.fill('input[type="password"]', "admin123")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/", { timeout: 5000 }).catch(() => {})
  await page.waitForLoadState("networkidle")

  // 2. Dashboard
  console.log("\n=== PAGE 2: DASHBOARD ===")
  await page.screenshot({ path: "/tmp/appforge-dashboard.png", fullPage: true })
  console.log("Screenshot: /tmp/appforge-dashboard.png")

  const sidebar = await page.locator("aside").count()
  const logo = await page.locator("text=AppForge").first().isVisible().catch(() => false)
  const newProjectBtn = await page.locator("text=New Project").count()
  const pipeline = await page.locator("text=Pipeline").count()
  const columns = await page.locator("text=Research").count()
  console.log(`Sidebar: ${sidebar > 0 ? "OK" : "MISSING"}`)
  console.log(`Logo: ${logo ? "OK" : "MISSING"}`)
  console.log(`New Project button: ${newProjectBtn > 0 ? "OK" : "MISSING"}`)
  console.log(`Pipeline section: ${pipeline > 0 ? "OK" : "MISSING"}`)
  console.log(`Kanban columns: ${columns > 0 ? "OK" : "MISSING"}`)

  // Check project cards
  const cards = await page.locator('[class*="rounded-xl"][class*="cursor-pointer"]').count()
  console.log(`Project cards: ${cards}`)

  // 3. Click first project to go to ideation
  console.log("\n=== PAGE 3: PROJECT/IDEATION ===")
  const firstCard = page.locator('a[href*="/projects/"]').first()
  if (await firstCard.count() > 0) {
    await firstCard.click()
    await page.waitForLoadState("networkidle")
    await page.screenshot({ path: "/tmp/appforge-project.png", fullPage: true })
    console.log("Screenshot: /tmp/appforge-project.png")

    const backLink = await page.locator("text=Dashboard").count()
    const composer = await page.locator("textarea").count()
    const forgeBtn = await page.locator("text=Forge").count()
    const archiveBtn = await page.locator("text=Archive").count()
    const contextPanel = await page.locator("text=Context").count()
    console.log(`Back to Dashboard link: ${backLink > 0 ? "OK" : "MISSING"}`)
    console.log(`Chat composer: ${composer > 0 ? "OK" : "MISSING"}`)
    console.log(`Forge button: ${forgeBtn > 0 ? "OK" : "MISSING"}`)
    console.log(`Archive button: ${archiveBtn > 0 ? "OK" : "MISSING"}`)
    console.log(`Context panel: ${contextPanel > 0 ? "OK" : "MISSING"}`)
  } else {
    console.log("No project cards to click")
  }

  // 4. Approvals page
  console.log("\n=== PAGE 4: APPROVALS ===")
  await page.goto("http://localhost:3000/approvals")
  await page.waitForLoadState("networkidle")
  await page.screenshot({ path: "/tmp/appforge-approvals.png", fullPage: true })
  console.log("Screenshot: /tmp/appforge-approvals.png")

  const approvalsTitle = await page.locator("text=Approvals").first().isVisible().catch(() => false)
  const tabs = await page.locator("text=Pending").count()
  const approvedTab = await page.locator("text=Approved").count()
  const rejectedTab = await page.locator("text=Rejected").count()
  const emptyState = await page.locator("text=All clear").count()
  const tagPills = await page.locator("text=SEO Fixes").count()
  console.log(`Title: ${approvalsTitle ? "OK" : "MISSING"}`)
  console.log(`Pending tab: ${tabs > 0 ? "OK" : "MISSING"}`)
  console.log(`Approved tab: ${approvedTab > 0 ? "OK" : "MISSING"}`)
  console.log(`Rejected tab: ${rejectedTab > 0 ? "OK" : "MISSING"}`)
  console.log(`Empty state: ${emptyState > 0 ? "OK" : "MISSING"}`)
  console.log(`Context tag pills: ${tagPills > 0 ? "OK" : "MISSING"}`)

  // 5. Settings page
  console.log("\n=== PAGE 5: SETTINGS ===")
  await page.goto("http://localhost:3000/settings")
  await page.waitForLoadState("networkidle")
  await page.screenshot({ path: "/tmp/appforge-settings.png", fullPage: true })
  console.log("Screenshot: /tmp/appforge-settings.png")

  const settingsTitle = await page.locator("text=Settings").first().isVisible().catch(() => false)
  const nvidiaField = await page.locator("text=NVIDIA API Key").count()
  const githubField = await page.locator("text=GitHub Token").count()
  const vercelField = await page.locator("text=Vercel Token").count()
  const xField = await page.locator("text=X API Key").count()
  const saveBtn = await page.locator("text=Save").count()
  const platform = await page.locator("text=Vercel").count()
  console.log(`Title: ${settingsTitle ? "OK" : "MISSING"}`)
  console.log(`NVIDIA field: ${nvidiaField > 0 ? "OK" : "MISSING"}`)
  console.log(`GitHub field: ${githubField > 0 ? "OK" : "MISSING"}`)
  console.log(`Vercel field: ${vercelField > 0 ? "OK" : "MISSING"}`)
  console.log(`X field: ${xField > 0 ? "OK" : "MISSING"}`)
  console.log(`Save button: ${saveBtn > 0 ? "OK" : "MISSING"}`)
  console.log(`Platform section: ${platform > 0 ? "OK" : "MISSING"}`)

  // Console errors
  console.log("\n=== CONSOLE ERRORS ===")
  if (errors.length === 0) {
    console.log("None!")
  } else {
    errors.forEach((e) => console.log(`  ERROR: ${e}`))
  }

  await browser.close()
  console.log("\n=== DONE ===")
  console.log("Screenshots saved to /tmp/appforge-*.png")
}

main().catch(console.error)
