import { NextResponse } from "next/server"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import {
  getFilteredFinanceReport,
  getFinanceReportOptions,
} from "@/lib/finance-report-service"
import type { FinanceReportCategory } from "@/lib/finance-report-utils"

function serverError(error: unknown) {
  console.error("[api/finance/reports]", error)
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ message }, { status: 500 })
}

function parseCategory(value: string | null): FinanceReportCategory {
  if (
    value === "students" ||
    value === "teachers" ||
    value === "partners" ||
    value === "staff" ||
    value === "classes"
  ) {
    return value
  }
  return "all"
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const { searchParams } = new URL(req.url)
    if (searchParams.get("options") === "true") {
      const options = await getFinanceReportOptions(searchParams.get("search") ?? "")
      return NextResponse.json(options)
    }

    const report = await getFilteredFinanceReport({
      period: searchParams.get("period"),
      month: searchParams.get("month"),
      category: parseCategory(searchParams.get("category")),
      entityId: searchParams.get("entityId"),
    })

    return NextResponse.json(report)
  } catch (error) {
    return serverError(error)
  }
}
