import { prisma } from "@/lib/prisma"
import {
  addMonths,
  buildContractSummary,
  groupContractsByTeacher,
  startOfMonth,
  type CompensationType,
  type ContractSummary,
  type TeacherPayrollSummary,
} from "@/lib/contract-utils"

async function getClassStats(classIds: string[]) {
  const stats = {
    students: new Map<string, number>(),
    monthlyCollected: new Map<string, number>(),
    totalCollected: new Map<string, number>(),
  }

  if (!classIds.length) return stats

  const now = new Date()
  const monthStart = startOfMonth(now)
  const nextMonthStart = addMonths(monthStart, 1)

  const [studentCounts, monthlyPayments, totalPayments] = await Promise.all([
    prisma.student.groupBy({
      by: ["classId"],
      where: { classId: { in: classIds }, isActive: true },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["studentId"],
      where: {
        paidAt: { gte: monthStart, lt: nextMonthStart },
        student: { classId: { in: classIds }, isActive: true },
      },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["studentId"],
      where: { student: { classId: { in: classIds }, isActive: true } },
      _sum: { amount: true },
    }),
  ])

  for (const row of studentCounts) {
    if (row.classId) stats.students.set(row.classId, row._count._all)
  }

  const studentClassMap = await prisma.student.findMany({
    where: { classId: { in: classIds }, isActive: true },
    select: { id: true, classId: true },
  })

  const classByStudent = new Map(studentClassMap.map((row) => [row.id, row.classId!]))

  const addPaymentToClass = (target: Map<string, number>, studentId: string, amount: number) => {
    const classId = classByStudent.get(studentId)
    if (!classId) return
    target.set(classId, (target.get(classId) ?? 0) + amount)
  }

  for (const row of monthlyPayments) {
    addPaymentToClass(stats.monthlyCollected, row.studentId, row._sum.amount ?? 0)
  }

  for (const row of totalPayments) {
    addPaymentToClass(stats.totalCollected, row.studentId, row._sum.amount ?? 0)
  }

  return stats
}

async function getPayoutTotals(contractIds: string[]) {
  if (!contractIds.length) return new Map<string, number>()

  const totals = await prisma.teacherContractPayout.groupBy({
    by: ["contractId"],
    where: { contractId: { in: contractIds } },
    _sum: { amount: true },
  })

  return new Map(totals.map((row) => [row.contractId, row._sum.amount ?? 0]))
}

function mapContractRows(
  contracts: Array<{
    id: string
    compensationType: CompensationType
    salaryAmount: number | null
    percentage: number | null
    isActive: boolean
    note: string | null
    createdAt: Date
    updatedAt: Date
    teacher: { id: string; name: string; email: string }
    class: { id: string; name: string; level: string | null }
  }>,
  classStats: Awaited<ReturnType<typeof getClassStats>>,
  payoutTotals: Map<string, number>,
) {
  return contracts.map((contract) =>
    buildContractSummary({
      id: contract.id,
      compensationType: contract.compensationType,
      salaryAmount: contract.salaryAmount,
      percentage: contract.percentage,
      isActive: contract.isActive,
      note: contract.note,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      teacher: contract.teacher,
      class: contract.class,
      studentsCount: classStats.students.get(contract.classId) ?? 0,
      classMonthlyCollected: classStats.monthlyCollected.get(contract.classId) ?? 0,
      classTotalCollected: classStats.totalCollected.get(contract.classId) ?? 0,
      totalPaidOut: payoutTotals.get(contract.id) ?? 0,
    }),
  )
}

export async function mapContracts(includeInactive: boolean): Promise<ContractSummary[]> {
  const contracts = await prisma.teacherContract.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      class: { select: { id: true, name: true, level: true } },
    },
    orderBy: [{ teacher: { name: "asc" } }, { class: { name: "asc" } }],
  })

  const classIds = Array.from(new Set(contracts.map((row) => row.classId)))
  const classStats = await getClassStats(classIds)
  const payoutTotals = await getPayoutTotals(contracts.map((row) => row.id))

  return mapContractRows(contracts, classStats, payoutTotals)
}

export async function getContractSummaryById(contractId: string): Promise<ContractSummary | null> {
  const contract = await prisma.teacherContract.findUnique({
    where: { id: contractId },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      class: { select: { id: true, name: true, level: true } },
    },
  })

  if (!contract) return null

  const classStats = await getClassStats([contract.classId])
  const payoutTotals = await getPayoutTotals([contract.id])

  return mapContractRows([contract], classStats, payoutTotals)[0] ?? null
}

export async function getContractsOverview(includeInactive: boolean) {
  const contracts = await mapContracts(includeInactive)
  const teachers = groupContractsByTeacher(contracts)

  return {
    contracts,
    teachers,
    totals: {
      contractsCount: contracts.length,
      activeContracts: contracts.filter((row) => row.isActive).length,
      teachersCount: teachers.length,
      classesCount: contracts.length,
      studentsCount: contracts.reduce((sum, row) => sum + row.studentsCount, 0),
      monthlyPay: contracts.reduce((sum, row) => sum + row.monthlyPay, 0),
      totalPaidOut: contracts.reduce((sum, row) => sum + row.totalPaidOut, 0),
      balanceDue: contracts.reduce((sum, row) => sum + row.balanceDue, 0),
    },
  }
}

export function validateContractInput(input: {
  compensationType: CompensationType
  salaryAmount: number | null
  percentage: number | null
}) {
  if (input.compensationType === "SALARY") {
    if (input.salaryAmount == null || input.salaryAmount < 0) {
      return "Enter a valid monthly salary amount"
    }
    return null
  }

  if (input.percentage == null || input.percentage < 0 || input.percentage > 100) {
    return "Enter a valid percentage between 0 and 100"
  }

  return null
}

export async function validateTeacherAndClass(teacherId: string, classId: string) {
  const [teacher, cls] = await Promise.all([
    prisma.user.findFirst({
      where: { id: teacherId, role: "TEACHER", isActive: true },
      select: { id: true },
    }),
    prisma.class.findFirst({
      where: { id: classId, isActive: true },
      select: { id: true, teacherId: true },
    }),
  ])

  if (!teacher) return { error: "Teacher not found", status: 400 as const }
  if (!cls) return { error: "Class not found", status: 400 as const }
  if (cls.teacherId && cls.teacherId !== teacherId) {
    return { error: "Selected class is assigned to a different teacher", status: 409 as const }
  }

  return { ok: true as const }
}

export type { TeacherPayrollSummary }
