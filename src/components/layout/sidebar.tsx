"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, CheckSquare, Settings, Zap } from "lucide-react"

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
    <aside className="w-[260px] h-full flex-none flex flex-col bg-[#09090b] border-r border-white/[0.06]">
      <div className="px-5 py-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
          <Zap size={18} className="text-black" strokeWidth={2.5} fill="black" />
        </div>
        <div>
          <span className="text-white text-[15px] font-bold tracking-tight">AppForge</span>
          <span className="block text-[10px] text-zinc-500 font-medium tracking-wide uppercase">AI Factory</span>
        </div>
      </div>

      <nav className="flex-1 px-3 mt-1 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={[
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ease-out",
              isActive(href)
                ? "bg-white/[0.08] text-white shadow-sm"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
            ].join(" ")}
          >
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 pb-5">
        <Link
          href="/settings"
          className={[
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ease-out",
            isActive("/settings")
              ? "bg-white/[0.08] text-white"
              : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
          ].join(" ")}
        >
          <Settings size={18} strokeWidth={1.8} />
          Settings
        </Link>
      </div>
    </aside>
  )
}
