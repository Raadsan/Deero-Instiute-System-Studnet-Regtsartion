import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession, requireAdminSession } from "@/lib/finance-auth"
import type { CompensationType } from "@/lib/contract-utils"
import {
  getContractSummaryById,
  validateContractInput,
  validateTeacherAndClass,
} from "@/lib/contract-service"
import { mapPayoutResponse, recordedBySelect } from "@/lib/recorded-by"

type RouteContext = { params: Promise<{ id: string }> }

function serverError(error: unknown) {
  console.error("[api/contracts/[id]]", error)
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ message }, { status: 500 })
}

function parseCompensationType(value: unknown): CompensationType | null {
  if (value === "SALARY" || value === "PERCENTAGE") return value
  return null
}

async function getContractDetail(contractId: string) {
  const contract = await getContractSummaryById(contractId)
  if (!contract) return null

  const payouts = await prisma.teacherContractPayout.findMany({
    where: { contractId },
    orderBy: { paidAt: "desc" },
    take: 20,
    include: { recordedBy: { select: recordedBySelect } },
  })

  return {
    ...contract,
    payouts: payouts.map(mapPayoutResponse),
  }
}

// GET /api/contracts/[id]
export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const contract = await getContractDetail(id)
    if (!contract) return NextResponse.json({ message: "Contract not found" }, { status: 404 })

    return NextResponse.json(contract)
  } catch (error) {
    return serverError(error)
  }
}

// PATCH /api/contracts/[id]
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const session = await getSessionFromRequestCookies()
    const auth = requireAdminSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const existing = await prisma.teacherContract.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ message: "Contract not found" }, { status: 404 })

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

    const nextTeacherId = typeof teacherId === "string" ? teacherId : existing.teacherId
    const nextClassId = typeof classId === "string" ? classId : existing.classId
    const nextType = parseCompensationType(compensationType) ?? existing.compensationType
    const nextSalary = typeof salaryAmount === "number" ? salaryAmount : existing.salaryAmount
    const nextPercentage = typeof percentage === "number" ? percentage : existing.percentage

    const validationMessage = validateContractInput({
      compensationType: nextType,
      salaryAmount: nextType === "SALARY" ? nextSalary : null,
      percentage: nextType === "PERCENTAGE" ? nextPercentage : null,
    })
    if (validationMessage) return NextResponse.json({ message: validationMessage }, { status: 400 })

    if (nextTeacherId !== existing.teacherId || nextClassId !== existing.classId) {
      const relationCheck = await validateTeacherAndClass(nextTeacherId, nextClassId)
      if ("error" in relationCheck) {
        return NextResponse.json({ message: relationCheck.error }, { status: relationCheck.status })
      }

      const duplicate = await prisma.teacherContract.findFirst({
        where: {
          teacherId: nextTeacherId,
          classId: nextClassId,
          NOT: { id },
        },
        select: { id: true },
      })
      if (duplicate) {
        return NextResponse.json({ message: "A contract already exists for this teacher and class" }, { status: 409 })
      }
    }

    await prisma.teacherContract.update({
      where: { id },
      data: {
        teacherId: nextTeacherId,
        classId: nextClassId,
        compensationType: nextType,
        salaryAmount: nextType === "SALARY" ? nextSalary : null,
        percentage: nextType === "PERCENTAGE" ? nextPercentage : null,
        isActive: typeof isActive === "boolean" ? isActive : existing.isActive,
        note: typeof note === "string" ? note.trim() || null : existing.note,
      },
    })

    const contract = await getContractDetail(id)
    return NextResponse.json(contract)
  } catch (error) {
    return serverError(error)
  }
}

// DELETE /api/contracts/[id]
export async function DELETE(_: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const session = await getSessionFromRequestCookies()
    const auth = requireAdminSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const existing = await prisma.teacherContract.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ message: "Contract not found" }, { status: 404 })

    await prisma.teacherContract.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError(error)
  }
}
