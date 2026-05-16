<<<<<<< HEAD
export default function ApprovalsPage() {
  return (
    <div>
      <h1 className="text-white text-[18px] font-medium mb-6">Approvals</h1>
      <p className="text-[#555] text-sm">No pending approvals.</p>
=======
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, ExternalLink } from "lucide-react"
import type { ApprovalRequest } from "@/types"

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchApprovals()
  }, [])

  async function fetchApprovals() {
    const res = await fetch("/api/approvals")
    const json = await res.json()
    if (json.success) {
      setApprovals(json.data)
    }
    setIsLoading(false)
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    await fetch(`/api/approvals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action === "approve" ? "APPROVED" : "REJECTED" }),
    })
    await fetchApprovals()
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading approvals...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve agent-proposed changes
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {approvals.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">No pending approvals</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((approval) => (
              <div key={approval.id} className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{approval.title}</h3>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {approval.phase}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(approval.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="mb-3 text-sm text-muted-foreground">{approval.summary}</p>

                {approval.reasoning && (
                  <details className="mb-3">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                      View reasoning
                    </summary>
                    <p className="mt-2 rounded bg-muted p-3 text-xs">{approval.reasoning}</p>
                  </details>
                )}

                {approval.prUrl && (
                  <a
                    href={approval.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View PR <ExternalLink className="size-3" />
                  </a>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAction(approval.id, "approve")}
                  >
                    <CheckCircle className="size-3.5" data-icon="inline-start" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleAction(approval.id, "reject")}
                  >
                    <XCircle className="size-3.5" data-icon="inline-start" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
>>>>>>> 66dcf6bb2c6f4ac90238724d397c0d78437ec439
    </div>
  )
}
