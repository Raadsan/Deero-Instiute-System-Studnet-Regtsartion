import type React from "react"

import { redirect } from "next/navigation"
import AdminShell from "@/components/layout/admin-shell"
import { getRoleFromRequestCookies } from "@/lib/auth"

export default async function TeacherLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const role = await getRoleFromRequestCookies()
  if (!role) redirect("/login")
  if (role !== "TEACHER") redirect("/unauthorized")

  return <AdminShell role={role}>{children}</AdminShell>
}
