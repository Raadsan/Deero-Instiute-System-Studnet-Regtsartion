import { NextResponse } from "next/server"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import { getFinanceSummary } from "@/lib/finance-service"
import { buildFinanceSummaryCsv, buildFinanceSummaryPdf } from "@/lib/finance-export-service"

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const { searchParams } = new URL(req.url)
    const format = searchParams.get("format") ?? "excel"
    const summary = await getFinanceSummary()
    const stamp = new Date().toISOString().slice(0, 10)

    if (format === "pdf") {
      const bytes = await buildFinanceSummaryPdf(summary)
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="finance-dashboard-${stamp}.pdf"`,
          "Cache-Control": "no-store",
        },
      })
    }

    const csv = buildFinanceSummaryCsv(summary)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="finance-dashboard-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[api/finance/summary/export]", error)
    const message = error instanceof Error ? error.message : "Export failed"
    return NextResponse.json({ message }, { status: 500 })
  }
}
