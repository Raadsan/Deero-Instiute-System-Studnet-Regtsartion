import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import { mapPayoutResponse, recordedBySelect } from "@/lib/recorded-by"

type RouteContext = { params: Promise<{ id: string }> }

function serverError(error: unknown) {
  console.error("[api/staff/[id]/payouts]", error)
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ message }, { status: 500 })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const staff = await prisma.staff.findUnique({ where: { id }, select: { id: true } })
    if (!staff) return NextResponse.json({ message: "Staff member not found" }, { status: 404 })

    const body: unknown = await req.json()
    if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

    const { amount, note, period, paidAt } = body as {
      amount?: unknown
      note?: unknown
      period?: unknown
      paidAt?: unknown
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ message: "Valid payout amount is required" }, { status: 400 })
    }

    const payout = await prisma.staffSalaryPayout.create({
      data: {
        staffId: id,
        amount,
        note: typeof note === "string" && note.trim() ? note.trim() : null,
        period: typeof period === "string" && period.trim() ? period.trim() : null,
        paidAt: typeof paidAt === "string" && paidAt ? new Date(paidAt) : new Date(),
        recordedById: auth.session.userId,
      },
      include: { recordedBy: { select: recordedBySelect } },
    })

    return NextResponse.json(mapPayoutResponse(payout), { status: 201 })
  } catch (error) {
    return serverError(error)
  }
}

export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const staff = await prisma.staff.findUnique({ where: { id }, select: { id: true } })
    if (!staff) return NextResponse.json({ message: "Staff member not found" }, { status: 404 })

    const payouts = await prisma.staffSalaryPayout.findMany({
      where: { staffId: id },
      orderBy: { paidAt: "desc" },
      include: { recordedBy: { select: recordedBySelect } },
    })

    return NextResponse.json(payouts.map(mapPayoutResponse))
  } catch (error) {
    return serverError(error)
  }
}
