import { NextRequest, NextResponse } from "next/server"

import { getSessionFromRequestCookies } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/lib/generated/prisma/client"

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const limit = Math.min(Number(searchParams.get("limit") ?? 30) || 30, 100)

  const where: Prisma.SmsMessageWhereInput = {}
  if (status === "PENDING" || status === "SENT" || status === "FAILED" || status === "SKIPPED") {
    where.status = status
  }

  const rows = await prisma.smsMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      to: true,
      body: true,
      status: true,
      error: true,
      providerMessageId: true,
      createdAt: true,
      sentAt: true,
    },
  })

  return NextResponse.json(rows)
}
