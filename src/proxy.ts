import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"

const PUBLIC_PATHS = ["/login", "/api/auth/", "/api/webhooks/", "/api/cron/", "/api/jobs/", "/_next/", "/favicon.ico"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get("appforge_session")?.value
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const user = await verifyToken(token)
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
