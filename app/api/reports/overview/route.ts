import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { getAdminSystemReport } from "@/lib/admin-report-service"
import { getCachedReport } from "@/lib/report-cache"

const REPORT_CACHE_MS = 5 * 60 * 1000

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequestCookies()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const period = searchParams.get("period")
    const month = searchParams.get("month")
    const cacheKey = `admin-report:${period ?? "3m"}:${month ?? ""}`

    const report = await getCachedReport(cacheKey, REPORT_CACHE_MS, () =>
      getAdminSystemReport({ period, month }),
    )
    return NextResponse.json(report)
  } catch (error) {
    console.error("[api/reports/overview]", error)
    const message = error instanceof Error ? error.message : "Failed to load report"
    return NextResponse.json({ message }, { status: 500 })
  }
}
