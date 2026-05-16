import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { encrypt } from "@/lib/secrets"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const settings = await db.setting.findMany()

  // Return only key names with a flag indicating if value exists (never expose values)
  const data = settings.reduce<Record<string, boolean>>((acc, s) => {
    acc[s.key] = true
    return acc
  }, {})

  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json()) as Record<string, string>
  const entries = Object.entries(body)

  for (const [key, value] of entries) {
    const encryptedValue = encrypt(value)
    await db.setting.upsert({
      where: { key },
      create: { key, value: encryptedValue },
      update: { value: encryptedValue },
    })
  }

  return NextResponse.json({ success: true })
}
