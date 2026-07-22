import { NextResponse } from "next/server"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import { getAuditLog, type AuditEntryType } from "@/lib/audit-service"

function parseType(value: string | null): AuditEntryType | "ALL" | null {
  if (!value || value === "ALL") return "ALL"
  const allowed: AuditEntryType[] = [
    "STUDENT_PAYMENT",
    "PARTNER_PAYOUT",
    "TEACHER_PAYOUT",
    "STAFF_PAYOUT",
    "FINANCE_INCOME",
    "FINANCE_EXPENSE",
  ]
  return allowed.includes(value as AuditEntryType) ? (value as AuditEntryType) : null
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 50) || 50))
    const search = searchParams.get("search")?.trim() ?? ""
    const typeParam = searchParams.get("type")
    const type = parseType(typeParam)
    if (typeParam && type === null) {
      return NextResponse.json({ message: "Invalid type filter" }, { status: 400 })
    }

    const result = await getAuditLog({ page, pageSize, search, type: type ?? "ALL" })

    return NextResponse.json({
      success: true,
      message: "Audit log loaded",
      data: { entries: result.entries, pagination: result.pagination },
    })
  } catch (error) {
    console.error("[api/audit]", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
