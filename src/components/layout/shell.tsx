import { db } from "@/lib/db"
import { Sidebar } from "./sidebar"

export async function Shell({ children }: { children: React.ReactNode }) {
  const pendingCount = await db.approval.count({ where: { status: "PENDING" } })

  return (
    <div className="flex h-screen bg-[#000] overflow-hidden">
      <Sidebar pendingApprovals={pendingCount} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
