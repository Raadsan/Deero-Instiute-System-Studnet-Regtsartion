import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession, requireAdminSession } from "@/lib/finance-auth"
import { getPartnerSummaryById, syncPartnerClasses } from "@/lib/partner-service"
import { mapPayoutResponse, recordedBySelect } from "@/lib/recorded-by"

type RouteContext = { params: Promise<{ id: string }> }

function serverError(error: unknown) {
  console.error("[api/partners/[id]]", error)
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ message }, { status: 500 })
}

async function getPartnerDetail(partnerId: string) {
  const partner = await getPartnerSummaryById(partnerId)
  if (!partner) return null

  const payouts = await prisma.partnerPayout.findMany({
    where: { partnerId },
    orderBy: { paidAt: "desc" },
    take: 20,
    include: { recordedBy: { select: recordedBySelect } },
  })

  return {
    ...partner,
    payouts: payouts.map(mapPayoutResponse),
  }
}

// GET /api/partners/[id]
export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const partner = await getPartnerDetail(id)
    if (!partner) return NextResponse.json({ message: "Partner not found" }, { status: 404 })

    return NextResponse.json(partner)
  } catch (error) {
    return serverError(error)
  }
}

// PATCH /api/partners/[id]
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const session = await getSessionFromRequestCookies()
    const auth = requireAdminSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const existing = await prisma.partner.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ message: "Partner not found" }, { status: 404 })

    const body: unknown = await req.json()
    if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

    const { name, contactName, phone, email, feePerStudent, isActive, classIds } = body as {
      name?: unknown
      contactName?: unknown
      phone?: unknown
      email?: unknown
      feePerStudent?: unknown
      isActive?: unknown
      classIds?: unknown
    }

    const update: {
      name?: string
      contactName?: string | null
      phone?: string | null
      email?: string | null
      feePerStudent?: number
      isActive?: boolean
    } = {}

    if (typeof name === "string" && name.trim()) update.name = name.trim()
    if (typeof contactName === "string") update.contactName = contactName.trim() || null
    if (typeof phone === "string") update.phone = phone.trim() || null
    if (typeof email === "string") update.email = email.trim() ? email.trim().toLowerCase() : null
    if (typeof feePerStudent === "number" && feePerStudent >= 0) update.feePerStudent = feePerStudent
    if (typeof isActive === "boolean") update.isActive = isActive

    const updated = await prisma.partner.update({
      where: { id },
      data: update,
    })

    if (Array.isArray(classIds)) {
      const ids = classIds.filter((value): value is string => typeof value === "string")
      const fee = update.feePerStudent ?? updated.feePerStudent
      const syncResult = await syncPartnerClasses(id, fee, ids)
      if ("error" in syncResult) {
        return NextResponse.json({ message: syncResult.error }, { status: syncResult.status })
      }
    } else if (typeof update.feePerStudent === "number") {
      await prisma.partnerClass.updateMany({
        where: { partnerId: id },
        data: { feePerStudent: update.feePerStudent },
      })
    }

    const partner = await getPartnerDetail(id)
    return NextResponse.json(partner)
  } catch (error) {
    return serverError(error)
  }
}

// DELETE /api/partners/[id]
export async function DELETE(_: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const session = await getSessionFromRequestCookies()
    const auth = requireAdminSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const existing = await prisma.partner.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ message: "Partner not found" }, { status: 404 })

    await prisma.partner.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError(error)
  }
}
