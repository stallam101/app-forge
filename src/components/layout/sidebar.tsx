"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { LayoutDashboard, Bell, Settings } from "lucide-react"

export function Sidebar({ pendingApprovals }: { pendingApprovals: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, setPending] = useState(pendingApprovals)

  // Poll for new approvals every 15s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/approvals/count")
        if (!res.ok) return
        const { count } = (await res.json()) as { count: number }
        if (count !== pending) {
          setPending(count)
          router.refresh()
        }
      } catch {
        // swallow
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [pending, router])

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href)
  }

  return (
    <aside className="w-[220px] h-full flex-none flex flex-col bg-[#000] border-r border-[#1a1a1a]">
      <div className="px-4 py-5">
        <span className="text-white text-[14px] font-medium">AppForge</span>
      </div>

      <nav className="flex-1 px-2 space-y-0.5">
        <Link
          href="/"
          className={[
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150",
            isActive("/") ? "bg-[#111] text-white" : "text-[#888] hover:bg-[#0a0a0a] hover:text-white",
          ].join(" ")}
        >
          <LayoutDashboard size={16} />
          Dashboard
        </Link>

        <Link
          href="/approvals"
          className={[
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150",
            isActive("/approvals") ? "bg-[#111] text-white" : "text-[#888] hover:bg-[#0a0a0a] hover:text-white",
          ].join(" ")}
        >
          <Bell size={16} />
          <span className="flex-1">Approvals</span>
          {pending > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white text-black text-[10px] font-semibold">
              {pending > 99 ? "99+" : pending}
            </span>
          )}
        </Link>
      </nav>

      <div className="px-2 pb-4">
        <Link
          href="/settings"
          className={[
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150",
            isActive("/settings") ? "bg-[#111] text-white" : "text-[#888] hover:bg-[#0a0a0a] hover:text-white",
          ].join(" ")}
        >
          <Settings size={16} />
          Settings
        </Link>
      </div>
    </aside>
  )
}
