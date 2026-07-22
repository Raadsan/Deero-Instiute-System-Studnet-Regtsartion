import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import { getFinanceSummary } from "@/lib/finance-service"
import { getCachedReport } from "@/lib/report-cache"

const SUMMARY_CACHE_MS = 2 * 60 * 1000

function serverError(error: unknown) {
  console.error("[api/finance/summary]", error)
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ message }, { status: 500 })
}

export async function GET() {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const summary = await getCachedReport("finance-summary", SUMMARY_CACHE_MS, getFinanceSummary)
    return NextResponse.json(summary)
  } catch (error) {
    return serverError(error)
  }
}
