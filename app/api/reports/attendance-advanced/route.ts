import { NextRequest, NextResponse } from "next/server"

import { getAdvancedAttendanceReport } from "@/lib/advanced-attendance-report"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { getCachedReport } from "@/lib/report-cache"

const REPORT_CACHE_MS = 2 * 60 * 1000

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get("month")
    const threshold = searchParams.get("threshold")
    const cacheKey = `advanced-attendance:${month ?? "current"}:${threshold ?? "75"}`
    const report = await getCachedReport(cacheKey, REPORT_CACHE_MS, () =>
      getAdvancedAttendanceReport({ month, threshold }),
    )
    return NextResponse.json(report)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load advanced attendance report"
    const status = message.includes("must") || message.includes("between") ? 400 : 500
    console.error("[api/reports/attendance-advanced]", error)
    return NextResponse.json({ message }, { status })
  }
}
