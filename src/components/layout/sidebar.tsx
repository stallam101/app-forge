"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, CheckSquare, Settings } from "lucide-react"

const NAV_ITEMS = [
  { href: "/",           label: "Dashboard", icon: LayoutDashboard },
  { href: "/approvals",  label: "Approvals",  icon: CheckSquare },
]

export function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href)
  }

  return (
    <aside className="w-[220px] h-full flex-none flex flex-col bg-[#000] border-r border-[#1a1a1a]">
      <div className="px-4 py-5">
        <span className="text-white text-[14px] font-medium">AppForge</span>
      </div>

      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={[
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150",
              isActive(href)
                ? "bg-[#111] text-white"
                : "text-[#888] hover:bg-[#0a0a0a] hover:text-white",
            ].join(" ")}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-2 pb-4">
        <Link
          href="/settings"
          className={[
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150",
            isActive("/settings")
              ? "bg-[#111] text-white"
              : "text-[#888] hover:bg-[#0a0a0a] hover:text-white",
          ].join(" ")}
        >
          <Settings size={16} />
          Settings
        </Link>
      </div>
    </aside>
  )
}
