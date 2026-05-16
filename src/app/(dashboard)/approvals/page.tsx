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
    <div>
      <h1 className="text-white text-[18px] font-medium mb-6">
        Approvals{cards.length > 0 ? ` · ${cards.length}` : ""}
      </h1>
      <ApprovalList initial={cards} />
    </div>
  )
}
