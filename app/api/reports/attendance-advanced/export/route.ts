import { NextRequest, NextResponse } from "next/server"

import { getAdvancedAttendanceReport } from "@/lib/advanced-attendance-report"
import { buildAdvancedAttendancePdf, buildAdvancedAttendanceWorkbook } from "@/lib/advanced-attendance-export"
import { getSessionFromRequestCookies } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const format = searchParams.get("format") === "pdf" ? "pdf" : "excel"
    const report = await getAdvancedAttendanceReport({
      month: searchParams.get("month"),
      threshold: searchParams.get("threshold"),
    })
    const filename = `advanced-attendance-${report.range.month}`

    if (format === "pdf") {
      const bytes = await buildAdvancedAttendancePdf(report)
      return new NextResponse(Buffer.from(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
          "Cache-Control": "no-store",
        },
      })
    }

    const workbook = buildAdvancedAttendanceWorkbook(report)
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export advanced attendance report"
    const status = message.includes("must") || message.includes("between") ? 400 : 500
    console.error("[api/reports/attendance-advanced/export]", error)
    return NextResponse.json({ message }, { status })
  }
}
