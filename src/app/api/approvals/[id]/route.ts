import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { encrypt } from "@/lib/secrets"
import { launchGatewayJob } from "@/lib/gateway"
import { STATUS_TO_PHASE } from "@/lib/phase"
import type { ApprovalStatus, ProjectStatus, JobPhase } from "@/types"

type Params = { id: string }

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { status, credentialValue } = (await req.json()) as {
    status: ApprovalStatus
    credentialValue?: string
  }

  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const result = await db.$transaction(async (tx) => {
    const approval = await tx.approval.update({
      where: { id },
      data: { status, resolvedAt: new Date() },
    })

    if (status === "APPROVED") {
      if (approval.type === "PHASE_TRANSITION") {
        const meta = approval.metadata as { targetStatus?: ProjectStatus } | null
        const targetStatus = meta?.targetStatus
        if (targetStatus) {
          await tx.project.update({
            where: { id: approval.projectId },
            data: { status: targetStatus },
          })
          const phase = STATUS_TO_PHASE[targetStatus]
          if (phase) {
            const newJob = await tx.job.create({
              data: { projectId: approval.projectId, phase, status: "QUEUED" },
            })
            // Launch immediately — fire and forget after transaction commits
            void Promise.resolve().then(() =>
              launchGatewayJob(newJob.id, phase as JobPhase, approval.projectId).catch(async (err) => {
                await db.job.update({ where: { id: newJob.id }, data: { status: "FAILED" } })
                await db.jobEvent.create({ data: { jobId: newJob.id, type: "error", message: String(err) } })
              })
            )
          }
        }
      }

      if (approval.type === "CREDENTIAL_REQUEST" && credentialValue?.trim()) {
        const meta = approval.metadata as { key?: string } | null
        const settingKey = meta?.key
        if (settingKey) {
          await tx.setting.upsert({
            where: { key: settingKey },
            create: { key: settingKey, value: encrypt(credentialValue.trim()) },
            update: { value: encrypt(credentialValue.trim()) },
          })
        }
      }
    }

    return approval
  })

  return NextResponse.json(result)
}
