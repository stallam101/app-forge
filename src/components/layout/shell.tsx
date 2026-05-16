import { db } from "@/lib/db"
import { Sidebar } from "./sidebar"

export async function Shell({ children }: { children: React.ReactNode }) {
  const pendingCount = await db.approval.count({ where: { status: "PENDING" } })

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b]">
      <Sidebar pendingApprovals={pendingCount} />
      <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
    </div>
  )
}
