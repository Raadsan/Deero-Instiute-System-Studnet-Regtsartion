import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import { mapPayoutResponse, recordedBySelect } from "@/lib/recorded-by"

type RouteContext = { params: Promise<{ id: string }> }

function serverError(error: unknown) {
  console.error("[api/contracts/[id]/payouts]", error)
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ message }, { status: 500 })
}

// POST /api/contracts/[id]/payouts
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
  const session = await getSessionFromRequestCookies()
  const auth = requireFinanceSession(session)
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const contract = await prisma.teacherContract.findUnique({ where: { id }, select: { id: true } })
    if (!contract) return NextResponse.json({ message: "Contract not found" }, { status: 404 })

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

    const payout = await prisma.teacherContractPayout.create({
      data: {
        contractId: id,
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

// GET /api/contracts/[id]/payouts
export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
  const session = await getSessionFromRequestCookies()
  const auth = requireFinanceSession(session)
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const contract = await prisma.teacherContract.findUnique({ where: { id }, select: { id: true } })
    if (!contract) return NextResponse.json({ message: "Contract not found" }, { status: 404 })

    const payouts = await prisma.teacherContractPayout.findMany({
      where: { contractId: id },
      orderBy: { paidAt: "desc" },
      include: { recordedBy: { select: recordedBySelect } },
    })

    return NextResponse.json(payouts.map(mapPayoutResponse))
  } catch (error) {
    return serverError(error)
  }
}
