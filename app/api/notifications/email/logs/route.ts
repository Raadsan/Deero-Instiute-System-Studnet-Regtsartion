import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import type { Prisma } from "@/lib/generated/prisma/client"

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const limit = Math.min(Number(searchParams.get("limit") ?? 30) || 30, 100)

  const where: Prisma.EmailMessageWhereInput = {}
  if (status === "PENDING" || status === "SENT" || status === "FAILED" || status === "SKIPPED") {
    where.status = status
  }

  const rows = await prisma.emailMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      to: true,
      subject: true,
      status: true,
      error: true,
      createdAt: true,
      sentAt: true,
      providerMessageId: true,
    },
  })

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      to: r.to ?? null,
      subject: r.subject ?? null,
      status: r.status ?? null,
      error: r.error ?? null,
      providerMessageId: r.providerMessageId ?? null,
      createdAt: r.createdAt ?? null,
      sentAt: r.sentAt ?? null,
    })),
  )
}
