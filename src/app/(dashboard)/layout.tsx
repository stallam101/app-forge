import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { Shell } from "@/components/layout/shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return <Shell>{children}</Shell>
}
