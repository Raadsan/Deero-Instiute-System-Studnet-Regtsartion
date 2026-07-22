import type React from "react"
import { redirect } from "next/navigation"
import AdminShell from "@/components/layout/admin-shell"
import { getRoleFromRequestCookies } from "@/lib/auth"

export default async function FinanceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const role = await getRoleFromRequestCookies()
  if (!role) redirect("/login")
  return <AdminShell role={role}>{children}</AdminShell>
}
