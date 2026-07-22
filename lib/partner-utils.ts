export type PartnerClassLink = {
  id: string
  classId: string
  className: string
  classLevel: string | null
  studentsCount: number
  feePerStudent: number
  monthlyDue: number
}

export type PartnerSummary = {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  feePerStudent: number
  isActive: boolean
  classesCount: number
  studentsCount: number
  monthlyDue: number
  totalPaidOut: number
  balanceDue: number
  classes: PartnerClassLink[]
  createdAt: string
  updatedAt: string
}

export function resolveClassFee(partnerFee: number, linkFee: number | null | undefined) {
  if (typeof linkFee === "number" && linkFee >= 0) return linkFee
  return partnerFee
}

export function buildPartnerSummary(input: {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  feePerStudent: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  classes: Array<{
    id: string
    feePerStudent: number | null
    class: { id: string; name: string; level: string | null }
  }>
  studentCounts: Map<string, number>
  payoutTotal: number
}): PartnerSummary {
  const classes: PartnerClassLink[] = input.classes.map((link) => {
    const studentsCount = input.studentCounts.get(link.class.id) ?? 0
    const feePerStudent = resolveClassFee(input.feePerStudent, link.feePerStudent)
    return {
      id: link.id,
      classId: link.class.id,
      className: link.class.name,
      classLevel: link.class.level,
      studentsCount,
      feePerStudent,
      monthlyDue: studentsCount * feePerStudent,
    }
  })

  const studentsCount = classes.reduce((sum, row) => sum + row.studentsCount, 0)
  const monthlyDue = classes.reduce((sum, row) => sum + row.monthlyDue, 0)
  const totalPaidOut = input.payoutTotal

  return {
    id: input.id,
    name: input.name,
    contactName: input.contactName,
    phone: input.phone,
    email: input.email,
    feePerStudent: input.feePerStudent,
    isActive: input.isActive,
    classesCount: classes.length,
    studentsCount,
    monthlyDue,
    totalPaidOut,
    balanceDue: Math.max(0, monthlyDue - totalPaidOut),
    classes,
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
  }
}

export function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
