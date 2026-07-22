import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { archiveOldAttendance } from "@/lib/attendance-archive"

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return false
  const authHeader = req.headers.get("authorization")
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null
  const headerSecret = req.headers.get("x-cron-secret")?.trim()
  return bearer === cronSecret || headerSecret === cronSecret
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequestCookies()
    const allowed =
      isAuthorized(req) ||
      (process.env.NODE_ENV !== "production" && session?.role === "ADMIN")

    if (!allowed) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const days = Number(process.env.ATTENDANCE_ARCHIVE_AFTER_DAYS ?? 365) || 365
    const result = await archiveOldAttendance(days)
    return NextResponse.json({ success: true, message: "Attendance archived", data: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive attendance"
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
