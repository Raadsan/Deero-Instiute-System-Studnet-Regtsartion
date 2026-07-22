import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { getAdminSystemReport } from "@/lib/admin-report-service"
import { buildAdminReportPdf } from "@/lib/admin-report-export"

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get("period")
  const month = searchParams.get("month")

  const report = await getAdminSystemReport({ period, month })
  const bytes = await buildAdminReportPdf(report)
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="school-report-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
