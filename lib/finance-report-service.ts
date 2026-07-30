import { prisma } from "@/lib/prisma"
import {
  resolveReportDateRange,
  type FinanceReportCategory,
} from "@/lib/finance-report-utils"
import { buildStudentSearchFilter } from "@/lib/student-search"

export { buildFinanceReportCsv, buildFinanceReportPdf } from "@/lib/finance-export-service"

export async function getFinanceReportOptions(search?: string) {
  const studentSearch = buildStudentSearchFilter(search ?? "")
  const [classes, teachers, partners, staff, students] = await Promise.all([
    prisma.class.findMany({
      where: { isActive: true },
      select: { id: true, name: true, level: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "TEACHER", isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.partner.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true, jobTitle: true },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: {
        isActive: true,
        ...(studentSearch ?? {}),
      },
      select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 100,
    }),
  ])

  return {
    classes,
    teachers,
    partners,
    staff,
    students: students.map((row) => ({
      id: row.id,
      name: `${row.firstName} ${row.lastName}`,
      className: row.class?.name ?? null,
    })),
  }
}

type ReportLine = {
  date: string
  category: string
  name: string
  description: string
  amount: number
  direction: "income" | "expense"
}

export async function getFilteredFinanceReport(input: {
  period?: string | null
  month?: string | null
  category?: FinanceReportCategory
  entityId?: string | null
}) {
  const range = resolveReportDateRange({ period: input.period, month: input.month })
  const category = input.category ?? "all"
  const entityId = input.entityId?.trim() || null
  const dateFilter = { gte: range.from, lte: range.to }

  const lines: ReportLine[] = []

  const [payments, partnerPayouts, teacherPayouts, staffPayouts, entries] = await Promise.all([
    category === "all" || category === "students" || category === "classes"
      ? prisma.payment.findMany({
      where: {
        paidAt: dateFilter,
        ...(category === "classes" && entityId ? { student: { classId: entityId } } : {}),
        ...(category === "students" && entityId ? { studentId: entityId } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            classId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
      take: 5000,
    })
      : Promise.resolve([]),
    category === "all" || category === "partners"
      ? prisma.partnerPayout.findMany({
          where: {
            paidAt: dateFilter,
            ...(entityId && category === "partners" ? { partnerId: entityId } : {}),
          },
          include: { partner: { select: { id: true, name: true } } },
          orderBy: { paidAt: "desc" },
        })
      : Promise.resolve([]),
    category === "all" || category === "teachers"
      ? prisma.teacherContractPayout.findMany({
          where: {
            paidAt: dateFilter,
            ...(entityId && category === "teachers" ? { contract: { teacherId: entityId } } : {}),
          },
          include: {
            contract: {
              include: {
                teacher: { select: { id: true, name: true } },
                class: { select: { name: true } },
              },
            },
          },
          orderBy: { paidAt: "desc" },
        })
      : Promise.resolve([]),
    category === "all" || category === "staff"
      ? prisma.staffSalaryPayout.findMany({
          where: {
            paidAt: dateFilter,
            ...(entityId && category === "staff" ? { staffId: entityId } : {}),
          },
          include: { staff: { select: { id: true, name: true } } },
          orderBy: { paidAt: "desc" },
        })
      : Promise.resolve([]),
    category === "all"
      ? prisma.financeEntry.findMany({
          where: { occurredAt: dateFilter },
          orderBy: { occurredAt: "desc" },
        })
      : Promise.resolve([]),
  ])

  for (const payment of payments) {
    lines.push({
      date: payment.paidAt.toISOString(),
      category: "Student Fee",
      name: `${payment.student.firstName} ${payment.student.lastName}`,
      description: payment.student.class?.name ?? "No class",
      amount: payment.amount,
      direction: "income",
    })
  }

  for (const payout of partnerPayouts) {
    lines.push({
      date: payout.paidAt.toISOString(),
      category: "Partner Payout",
      name: payout.partner.name,
      description: payout.period ?? payout.note ?? "Partner payment",
      amount: payout.amount,
      direction: "expense",
    })
  }

  for (const payout of teacherPayouts) {
    lines.push({
      date: payout.paidAt.toISOString(),
      category: "Teacher Payroll",
      name: payout.contract.teacher.name,
      description: payout.contract.class.name,
      amount: payout.amount,
      direction: "expense",
    })
  }

  for (const payout of staffPayouts) {
    lines.push({
      date: payout.paidAt.toISOString(),
      category: "Staff Salary",
      name: payout.staff.name,
      description: payout.period ?? payout.note ?? "Staff salary",
      amount: payout.amount,
      direction: "expense",
    })
  }

  for (const entry of entries) {
    lines.push({
      date: entry.occurredAt.toISOString(),
      category: entry.type === "INCOME" ? "Other Income" : "Other Expense",
      name: entry.title,
      description: entry.category ?? entry.note ?? "",
      amount: entry.amount,
      direction: entry.type === "INCOME" ? "income" : "expense",
    })
  }

  lines.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalIncome = lines.filter((row) => row.direction === "income").reduce((sum, row) => sum + row.amount, 0)
  const totalExpenses = lines.filter((row) => row.direction === "expense").reduce((sum, row) => sum + row.amount, 0)

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
    },
    filters: {
      category,
      entityId,
    },
    totals: {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      transactionCount: lines.length,
    },
    lines,
  }
}
