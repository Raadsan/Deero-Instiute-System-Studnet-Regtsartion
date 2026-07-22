import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession, requireAdminSession } from "@/lib/finance-auth"
import { getPartnerSummaryById, mapPartners, syncPartnerClasses } from "@/lib/partner-service"

function serverError(error: unknown) {
  console.error("[api/partners]", error)
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ message }, { status: 500 })
}

// GET /api/partners (ADMIN)
export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get("includeInactive") === "true"
    const partners = await mapPartners(includeInactive)

    const totals = {
      partnersCount: partners.length,
      activePartners: partners.filter((partner) => partner.isActive).length,
      classesCount: partners.reduce((sum, partner) => sum + partner.classesCount, 0),
      studentsCount: partners.reduce((sum, partner) => sum + partner.studentsCount, 0),
      monthlyDue: partners.reduce((sum, partner) => sum + partner.monthlyDue, 0),
      totalPaidOut: partners.reduce((sum, partner) => sum + partner.totalPaidOut, 0),
      balanceDue: partners.reduce((sum, partner) => sum + partner.balanceDue, 0),
    }

    return NextResponse.json({ partners, totals })
  } catch (error) {
    return serverError(error)
  }
}

// POST /api/partners (ADMIN)
export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireAdminSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

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

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ message: "Partner name is required" }, { status: 400 })
    }

    const fee = typeof feePerStudent === "number" && feePerStudent >= 0 ? feePerStudent : 0
    const ids = Array.isArray(classIds) ? classIds.filter((value): value is string => typeof value === "string") : []

    const created = await prisma.partner.create({
      data: {
        name: name.trim(),
        contactName: typeof contactName === "string" && contactName.trim() ? contactName.trim() : null,
        phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
        email: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null,
        feePerStudent: fee,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
    })

    const syncResult = await syncPartnerClasses(created.id, fee, ids)
    if ("error" in syncResult) {
      await prisma.partner.delete({ where: { id: created.id } })
      return NextResponse.json({ message: syncResult.error }, { status: syncResult.status })
    }

    const createdPartner = await getPartnerSummaryById(created.id)
    if (!createdPartner) {
      return NextResponse.json({ message: "Partner created but could not be loaded" }, { status: 500 })
    }

    return NextResponse.json(createdPartner, { status: 201 })
  } catch (error) {
    return serverError(error)
  }
}
