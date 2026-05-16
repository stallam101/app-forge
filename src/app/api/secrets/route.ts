import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  const secrets = await db.secret.findMany()

  // Return only key names with a flag indicating if value exists (never expose values)
  const data = secrets.reduce<Record<string, boolean>>((acc, s) => {
    acc[s.keyName] = true
    return acc
  }, {})

  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  // For hackathon: store as plain text (production would use AES-256)
  const entries = Object.entries(body) as [string, string][]

  for (const [key, value] of entries) {
    await db.secret.upsert({
      where: { keyName: key },
      create: { keyName: key, encryptedValue: value },
      update: { encryptedValue: value },
    })
  }

  return NextResponse.json({ success: true })
}
