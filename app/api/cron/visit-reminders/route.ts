import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { processVisitReminders } from "@/lib/visit-reminders"

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (cronSecret) {
    const authHeader = req.headers.get("authorization")
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null
    const headerSecret = req.headers.get("x-cron-secret")?.trim()
    if (bearer === cronSecret || headerSecret === cronSecret) return true
  }
  return false
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

    const result = await processVisitReminders()
    return NextResponse.json({ success: true, message: "Visit reminders processed", data: result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message ?? "Failed to process visit reminders" },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
