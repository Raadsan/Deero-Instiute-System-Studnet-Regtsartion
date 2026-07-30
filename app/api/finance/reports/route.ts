import { NextResponse } from "next/server"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import {
  getFilteredFinanceReport,
  getFinanceReportOptions,
} from "@/lib/finance-report-service"
import type { FinanceReportCategory } from "@/lib/finance-report-utils"
import { getCachedReport } from "@/lib/report-cache"

const FINANCE_REPORT_CACHE_MS = 30 * 1000

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
      const search = searchParams.get("search") ?? ""
      const options = await getCachedReport(`finance-report-options:${search}`, FINANCE_REPORT_CACHE_MS, () =>
        getFinanceReportOptions(search),
      )
      return NextResponse.json(options)
    }

    const input = {
      period: searchParams.get("period"),
      month: searchParams.get("month"),
      category: parseCategory(searchParams.get("category")),
      entityId: searchParams.get("entityId"),
    }
    const cacheKey = `finance-report:${input.period ?? ""}:${input.month ?? ""}:${input.category}:${input.entityId ?? ""}`
    const report = await getCachedReport(cacheKey, FINANCE_REPORT_CACHE_MS, () => getFilteredFinanceReport(input))

    return NextResponse.json(report)
  } catch (error) {
    return serverError(error)
  }
}
