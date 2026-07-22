import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"

function serverError(error: unknown) {
  console.error("[api/staff]", error)
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ message }, { status: 500 })
}

async function mapStaff(includeInactive: boolean) {
  const staff = await prisma.staff.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
  })

  const payouts = staff.length
    ? await prisma.staffSalaryPayout.groupBy({
        by: ["staffId"],
        where: { staffId: { in: staff.map((row) => row.id) } },
        _sum: { amount: true },
      })
    : []

  const paidMap = new Map(payouts.map((row) => [row.staffId, row._sum.amount ?? 0]))

  return staff.map((member) => {
    const totalPaidOut = paidMap.get(member.id) ?? 0
    const monthlySalary = member.monthlySalary
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      jobTitle: member.jobTitle,
      monthlySalary,
      totalPaidOut,
      balanceDue: Math.max(0, monthlySalary - totalPaidOut),
      isActive: member.isActive,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    }
  })
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get("includeInactive") === "true"
    const staff = await mapStaff(includeInactive)

    return NextResponse.json({
      staff,
      totals: {
        staffCount: staff.length,
        activeStaff: staff.filter((row) => row.isActive).length,
        monthlyPayroll: staff.reduce((sum, row) => sum + row.monthlySalary, 0),
        totalPaidOut: staff.reduce((sum, row) => sum + row.totalPaidOut, 0),
        balanceDue: staff.reduce((sum, row) => sum + row.balanceDue, 0),
      },
    })
  } catch (error) {
    return serverError(error)
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

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

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ message: "Staff name is required" }, { status: 400 })
    }

    const salary = typeof monthlySalary === "number" && monthlySalary >= 0 ? monthlySalary : 0

    const created = await prisma.staff.create({
      data: {
        name: name.trim(),
        email: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null,
        phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
        jobTitle: typeof jobTitle === "string" && jobTitle.trim() ? jobTitle.trim() : null,
        monthlySalary: salary,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
    })

    const [summary] = (await mapStaff(true)).filter((row) => row.id === created.id)
    return NextResponse.json(summary, { status: 201 })
  } catch (error) {
    return serverError(error)
  }
}
