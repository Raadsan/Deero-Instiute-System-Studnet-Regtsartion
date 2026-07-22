import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import {
  buildFinanceReportCsv,
  buildFinanceReportPdf,
  getFilteredFinanceReport,
} from "@/lib/finance-report-service"
import type { FinanceReportCategory } from "@/lib/finance-report-utils"

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

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  const auth = requireFinanceSession(session)
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") ?? "excel"
  const report = await getFilteredFinanceReport({
    period: searchParams.get("period"),
    month: searchParams.get("month"),
    category: parseCategory(searchParams.get("category")),
    entityId: searchParams.get("entityId"),
  })

  const stamp = new Date().toISOString().slice(0, 10)

  if (format === "pdf") {
    const bytes = await buildFinanceReportPdf(report)
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="finance-report-${stamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  }

  const csv = buildFinanceReportCsv(report)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="finance-report-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
