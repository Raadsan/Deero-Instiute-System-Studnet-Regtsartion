import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"

type RouteContext = { params: Promise<{ id: string }> }

function serverError(error: unknown) {
  console.error("[api/staff/[id]]", error)
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ message }, { status: 500 })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const existing = await prisma.staff.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ message: "Staff member not found" }, { status: 404 })

    const body: unknown = await req.json()
    if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

    const { name, email, phone, jobTitle, monthlySalary, isActive } = body as {
      name?: unknown
      email?: unknown
      phone?: unknown
      jobTitle?: unknown
      monthlySalary?: unknown
      isActive?: unknown
    }

    const updated = await prisma.staff.update({
      where: { id },
      data: {
        ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
        ...(typeof email === "string" ? { email: email.trim() ? email.trim().toLowerCase() : null } : {}),
        ...(typeof phone === "string" ? { phone: phone.trim() || null } : {}),
        ...(typeof jobTitle === "string" ? { jobTitle: jobTitle.trim() || null } : {}),
        ...(typeof monthlySalary === "number" && monthlySalary >= 0 ? { monthlySalary } : {}),
        ...(typeof isActive === "boolean" ? { isActive } : {}),
      },
    })

    const paid = await prisma.staffSalaryPayout.aggregate({ where: { staffId: id }, _sum: { amount: true } })
    const totalPaidOut = paid._sum.amount ?? 0

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      jobTitle: updated.jobTitle,
      monthlySalary: updated.monthlySalary,
      totalPaidOut,
      balanceDue: Math.max(0, updated.monthlySalary - totalPaidOut),
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    return serverError(error)
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const existing = await prisma.staff.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ message: "Staff member not found" }, { status: 404 })

    await prisma.staff.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError(error)
  }
}
