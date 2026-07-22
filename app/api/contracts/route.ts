import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession, requireAdminSession } from "@/lib/finance-auth"
import type { CompensationType } from "@/lib/contract-utils"
import {
  getContractSummaryById,
  getContractsOverview,
  validateContractInput,
  validateTeacherAndClass,
} from "@/lib/contract-service"

function serverError(error: unknown) {
  console.error("[api/contracts]", error)
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ message }, { status: 500 })
}

function parseCompensationType(value: unknown): CompensationType | null {
  if (value === "SALARY" || value === "PERCENTAGE") return value
  return null
}

// GET /api/contracts (ADMIN)
export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get("includeInactive") === "true"
    const overview = await getContractsOverview(includeInactive)

    return NextResponse.json(overview)
  } catch (error) {
    return serverError(error)
  }
}

// POST /api/contracts (ADMIN)
export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireAdminSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const body: unknown = await req.json()
    if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

    const { teacherId, classId, compensationType, salaryAmount, percentage, isActive, note } = body as {
      teacherId?: unknown
      classId?: unknown
      compensationType?: unknown
      salaryAmount?: unknown
      percentage?: unknown
      isActive?: unknown
      note?: unknown
    }

    if (typeof teacherId !== "string" || typeof classId !== "string") {
      return NextResponse.json({ message: "Teacher and class are required" }, { status: 400 })
    }

    const type = parseCompensationType(compensationType)
    if (!type) return NextResponse.json({ message: "Select salary or percentage" }, { status: 400 })

    const salary = typeof salaryAmount === "number" ? salaryAmount : null
    const percent = typeof percentage === "number" ? percentage : null
    const validationMessage = validateContractInput({
      compensationType: type,
      salaryAmount: salary,
      percentage: percent,
    })
    if (validationMessage) return NextResponse.json({ message: validationMessage }, { status: 400 })

    const relationCheck = await validateTeacherAndClass(teacherId, classId)
    if ("error" in relationCheck) {
      return NextResponse.json({ message: relationCheck.error }, { status: relationCheck.status })
    }

    const existing = await prisma.teacherContract.findUnique({
      where: { teacherId_classId: { teacherId, classId } },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ message: "A contract already exists for this teacher and class" }, { status: 409 })
    }

    const created = await prisma.teacherContract.create({
      data: {
        teacherId,
        classId,
        compensationType: type,
        salaryAmount: type === "SALARY" ? salary : null,
        percentage: type === "PERCENTAGE" ? percent : null,
        isActive: typeof isActive === "boolean" ? isActive : true,
        note: typeof note === "string" && note.trim() ? note.trim() : null,
      },
    })

    const summary = await getContractSummaryById(created.id)
    if (!summary) {
      return NextResponse.json({ message: "Contract created but could not be loaded" }, { status: 500 })
    }

    return NextResponse.json(summary, { status: 201 })
  } catch (error) {
    return serverError(error)
  }
}
