import { prisma } from "@/lib/prisma"
import { mapRecordedBy, recordedBySelect } from "@/lib/recorded-by"
import { buildPaginationMeta } from "@/lib/pagination"

export type AuditEntryType =
  | "STUDENT_PAYMENT"
  | "PARTNER_PAYOUT"
  | "TEACHER_PAYOUT"
  | "STAFF_PAYOUT"
  | "FINANCE_INCOME"
  | "FINANCE_EXPENSE"

export type AuditLogEntry = {
  id: string
  type: AuditEntryType
  description: string
  amount: number
  currency: string
  occurredAt: string
  note: string | null
  recordedBy: ReturnType<typeof mapRecordedBy>
}

const AUDIT_TYPE_LABELS: Record<AuditEntryType, string> = {
  STUDENT_PAYMENT: "Student Fee",
  PARTNER_PAYOUT: "Partner Payout",
  TEACHER_PAYOUT: "Teacher Payroll",
  STAFF_PAYOUT: "Staff Salary",
  FINANCE_INCOME: "Income",
  FINANCE_EXPENSE: "Expense",
}

export function getAuditTypeLabel(type: AuditEntryType) {
  return AUDIT_TYPE_LABELS[type]
}

async function fetchStudentPayments(skip: number, take: number, search: string) {
  const where = search
    ? {
        OR: [
          { note: { contains: search, mode: "insensitive" as const } },
          { student: { firstName: { contains: search, mode: "insensitive" as const } } },
          { student: { lastName: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : undefined

  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { paidAt: "desc" },
      include: {
        recordedBy: { select: recordedBySelect },
        student: { select: { firstName: true, lastName: true } },
      },
    }),
  ])

  return {
    total,
    entries: rows.map((payment) => ({
      id: payment.id,
      type: "STUDENT_PAYMENT" as const,
      description: `${payment.student.firstName} ${payment.student.lastName}`.trim(),
      amount: payment.amount,
      currency: payment.currency,
      occurredAt: payment.paidAt.toISOString(),
      note: payment.note,
      recordedBy: mapRecordedBy(payment.recordedBy),
    })),
  }
}

async function fetchPartnerPayouts(skip: number, take: number, search: string) {
  const where = search
    ? {
        OR: [
          { note: { contains: search, mode: "insensitive" as const } },
          { partner: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : undefined

  const [total, rows] = await Promise.all([
    prisma.partnerPayout.count({ where }),
    prisma.partnerPayout.findMany({
      where,
      skip,
      take,
      orderBy: { paidAt: "desc" },
      include: {
        recordedBy: { select: recordedBySelect },
        partner: { select: { name: true } },
      },
    }),
  ])

  return {
    total,
    entries: rows.map((payout) => ({
      id: payout.id,
      type: "PARTNER_PAYOUT" as const,
      description: payout.partner.name,
      amount: payout.amount,
      currency: payout.currency,
      occurredAt: payout.paidAt.toISOString(),
      note: payout.note ?? payout.period,
      recordedBy: mapRecordedBy(payout.recordedBy),
    })),
  }
}

async function fetchTeacherPayouts(skip: number, take: number, search: string) {
  const where = search
    ? {
        OR: [
          { note: { contains: search, mode: "insensitive" as const } },
          { contract: { teacher: { name: { contains: search, mode: "insensitive" as const } } } },
          { contract: { class: { name: { contains: search, mode: "insensitive" as const } } } },
        ],
      }
    : undefined

  const [total, rows] = await Promise.all([
    prisma.teacherContractPayout.count({ where }),
    prisma.teacherContractPayout.findMany({
      where,
      skip,
      take,
      orderBy: { paidAt: "desc" },
      include: {
        recordedBy: { select: recordedBySelect },
        contract: {
          select: {
            teacher: { select: { name: true } },
            class: { select: { name: true } },
          },
        },
      },
    }),
  ])

  return {
    total,
    entries: rows.map((payout) => ({
      id: payout.id,
      type: "TEACHER_PAYOUT" as const,
      description: `${payout.contract.teacher.name} — ${payout.contract.class.name}`,
      amount: payout.amount,
      currency: payout.currency,
      occurredAt: payout.paidAt.toISOString(),
      note: payout.note ?? payout.period,
      recordedBy: mapRecordedBy(payout.recordedBy),
    })),
  }
}

async function fetchStaffPayouts(skip: number, take: number, search: string) {
  const where = search
    ? {
        OR: [
          { note: { contains: search, mode: "insensitive" as const } },
          { staff: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : undefined

  const [total, rows] = await Promise.all([
    prisma.staffSalaryPayout.count({ where }),
    prisma.staffSalaryPayout.findMany({
      where,
      skip,
      take,
      orderBy: { paidAt: "desc" },
      include: {
        recordedBy: { select: recordedBySelect },
        staff: { select: { name: true } },
      },
    }),
  ])

  return {
    total,
    entries: rows.map((payout) => ({
      id: payout.id,
      type: "STAFF_PAYOUT" as const,
      description: payout.staff.name,
      amount: payout.amount,
      currency: payout.currency,
      occurredAt: payout.paidAt.toISOString(),
      note: payout.note ?? payout.period,
      recordedBy: mapRecordedBy(payout.recordedBy),
    })),
  }
}

async function fetchFinanceEntries(type: "INCOME" | "EXPENSE", skip: number, take: number, search: string) {
  const where = {
    type,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { note: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.financeEntry.count({ where }),
    prisma.financeEntry.findMany({
      where,
      skip,
      take,
      orderBy: { occurredAt: "desc" },
      include: { recordedBy: { select: recordedBySelect } },
    }),
  ])

  return {
    total,
    entries: rows.map((entry) => ({
      id: entry.id,
      type: entry.type === "INCOME" ? ("FINANCE_INCOME" as const) : ("FINANCE_EXPENSE" as const),
      description: entry.title,
      amount: entry.amount,
      currency: "USD",
      occurredAt: entry.occurredAt.toISOString(),
      note: entry.note ?? entry.category,
      recordedBy: mapRecordedBy(entry.recordedBy),
    })),
  }
}

export async function getAuditLog(args: {
  page?: number
  pageSize?: number
  type?: AuditEntryType | "ALL"
  search?: string
}) {
  const page = Math.max(1, args.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, args.pageSize ?? 50))
  const skip = (page - 1) * pageSize
  const search = args.search?.trim() ?? ""
  const type = args.type ?? "ALL"

  if (type === "STUDENT_PAYMENT") {
    const result = await fetchStudentPayments(skip, pageSize, search)
    return { entries: result.entries, pagination: buildPaginationMeta(page, pageSize, result.total) }
  }
  if (type === "PARTNER_PAYOUT") {
    const result = await fetchPartnerPayouts(skip, pageSize, search)
    return { entries: result.entries, pagination: buildPaginationMeta(page, pageSize, result.total) }
  }
  if (type === "TEACHER_PAYOUT") {
    const result = await fetchTeacherPayouts(skip, pageSize, search)
    return { entries: result.entries, pagination: buildPaginationMeta(page, pageSize, result.total) }
  }
  if (type === "STAFF_PAYOUT") {
    const result = await fetchStaffPayouts(skip, pageSize, search)
    return { entries: result.entries, pagination: buildPaginationMeta(page, pageSize, result.total) }
  }
  if (type === "FINANCE_INCOME") {
    const result = await fetchFinanceEntries("INCOME", skip, pageSize, search)
    return { entries: result.entries, pagination: buildPaginationMeta(page, pageSize, result.total) }
  }
  if (type === "FINANCE_EXPENSE") {
    const result = await fetchFinanceEntries("EXPENSE", skip, pageSize, search)
    return { entries: result.entries, pagination: buildPaginationMeta(page, pageSize, result.total) }
  }

  const perSource = pageSize
  const [payments, partnerPayouts, teacherPayouts, staffPayouts, incomeEntries, expenseEntries] =
    await Promise.all([
      fetchStudentPayments(0, perSource, search),
      fetchPartnerPayouts(0, perSource, search),
      fetchTeacherPayouts(0, perSource, search),
      fetchStaffPayouts(0, perSource, search),
      fetchFinanceEntries("INCOME", 0, perSource, search),
      fetchFinanceEntries("EXPENSE", 0, perSource, search),
    ])

  const merged = [
    ...payments.entries,
    ...partnerPayouts.entries,
    ...teacherPayouts.entries,
    ...staffPayouts.entries,
    ...incomeEntries.entries,
    ...expenseEntries.entries,
  ]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, pageSize)

  const total =
    payments.total +
    partnerPayouts.total +
    teacherPayouts.total +
    staffPayouts.total +
    incomeEntries.total +
    expenseEntries.total

  return {
    entries: merged,
    pagination: buildPaginationMeta(page, pageSize, total),
  }
}
