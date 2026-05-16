import { db } from "@/lib/db"
import { ApprovalList } from "@/components/dashboard/approval-list"
import type { ApprovalCardData } from "@/types"

export const dynamic = "force-dynamic"

export default async function ApprovalsPage() {
  const approvals = await db.approval.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { name: true } } },
  })

  const cards: ApprovalCardData[] = approvals.map((a) => ({
    id: a.id,
    projectId: a.projectId,
    projectName: a.project.name,
    title: a.title,
    description: a.description,
    type: a.type,
    createdAt: a.createdAt,
  }))

  return (
    <div className="max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-white text-[20px] font-bold tracking-tight mb-1">
          Approvals{cards.length > 0 ? ` · ${cards.length}` : ""}
        </h1>
        <p className="text-zinc-500 text-[13px]">Review agent-proposed changes before they go live</p>
      </div>
      <ApprovalList initial={cards} />
    </div>
  )
}
