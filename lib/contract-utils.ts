export type CompensationType = "SALARY" | "PERCENTAGE"

export type ContractSummary = {
  id: string
  teacherId: string
  teacherName: string
  teacherEmail: string
  classId: string
  className: string
  classLevel: string | null
  compensationType: CompensationType
  salaryAmount: number | null
  percentage: number | null
  isActive: boolean
  note: string | null
  studentsCount: number
  classMonthlyCollected: number
  classTotalCollected: number
  monthlyPay: number
  totalPaidOut: number
  balanceDue: number
  createdAt: string
  updatedAt: string
}

export type TeacherPayrollSummary = {
  teacherId: string
  teacherName: string
  teacherEmail: string
  isActive: boolean
  contractsCount: number
  classesCount: number
  studentsCount: number
  monthlyPay: number
  totalPaidOut: number
  balanceDue: number
  contracts: ContractSummary[]
}

export function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

export function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1, 0, 0, 0, 0)
}

export function calculateMonthlyPay(input: {
  compensationType: CompensationType
  salaryAmount: number | null
  percentage: number | null
  classMonthlyCollected: number
}) {
  if (input.compensationType === "SALARY") {
    return Math.max(0, input.salaryAmount ?? 0)
  }

  const rate = Math.max(0, Math.min(100, input.percentage ?? 0))
  return (input.classMonthlyCollected * rate) / 100
}

export function buildContractSummary(input: {
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
  studentsCount: number
  classMonthlyCollected: number
  classTotalCollected: number
  totalPaidOut: number
}): ContractSummary {
  const monthlyPay = calculateMonthlyPay({
    compensationType: input.compensationType,
    salaryAmount: input.salaryAmount,
    percentage: input.percentage,
    classMonthlyCollected: input.classMonthlyCollected,
  })

  return {
    id: input.id,
    teacherId: input.teacher.id,
    teacherName: input.teacher.name,
    teacherEmail: input.teacher.email,
    classId: input.class.id,
    className: input.class.name,
    classLevel: input.class.level,
    compensationType: input.compensationType,
    salaryAmount: input.salaryAmount,
    percentage: input.percentage,
    isActive: input.isActive,
    note: input.note,
    studentsCount: input.studentsCount,
    classMonthlyCollected: input.classMonthlyCollected,
    classTotalCollected: input.classTotalCollected,
    monthlyPay,
    totalPaidOut: input.totalPaidOut,
    balanceDue: Math.max(0, monthlyPay - input.totalPaidOut),
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
  }
}

export function groupContractsByTeacher(contracts: ContractSummary[]): TeacherPayrollSummary[] {
  const map = new Map<string, TeacherPayrollSummary>()

  for (const contract of contracts) {
    const existing = map.get(contract.teacherId)
    if (!existing) {
      map.set(contract.teacherId, {
        teacherId: contract.teacherId,
        teacherName: contract.teacherName,
        teacherEmail: contract.teacherEmail,
        isActive: contract.isActive,
        contractsCount: 1,
        classesCount: 1,
        studentsCount: contract.studentsCount,
        monthlyPay: contract.monthlyPay,
        totalPaidOut: contract.totalPaidOut,
        balanceDue: contract.balanceDue,
        contracts: [contract],
      })
      continue
    }

    existing.contractsCount += 1
    existing.classesCount += 1
    existing.studentsCount += contract.studentsCount
    existing.monthlyPay += contract.monthlyPay
    existing.totalPaidOut += contract.totalPaidOut
    existing.balanceDue += contract.balanceDue
    existing.isActive = existing.isActive || contract.isActive
    existing.contracts.push(contract)
  }

  return Array.from(map.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName))
}
