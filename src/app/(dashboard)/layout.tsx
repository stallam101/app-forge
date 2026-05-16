<<<<<<< HEAD
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { Shell } from "@/components/layout/shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return <Shell>{children}</Shell>
=======
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, CheckCircle, Settings, Hammer } from "lucide-react"

const NAV_ITEMS = [
  { href: "/", label: "Projects", icon: LayoutDashboard },
  { href: "/approvals", label: "Approvals", icon: CheckCircle },
  { href: "/settings", label: "Settings", icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Hammer className="size-5 text-primary" />
          <span className="text-lg font-bold">AppForge</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-4 text-xs text-muted-foreground">
          AppForge v0.1 — Hackathon Build
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
>>>>>>> 66dcf6bb2c6f4ac90238724d397c0d78437ec439
}
