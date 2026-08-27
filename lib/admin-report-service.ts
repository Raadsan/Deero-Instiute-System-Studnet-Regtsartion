import { prisma } from "@/lib/prisma"
import { getContractsOverview } from "@/lib/contract-service"
import { mapPartners } from "@/lib/partner-service"
import { getFilteredFinanceReport } from "@/lib/finance-report-service"
import { addMonths, startOfMonth } from "@/lib/finance-utils"
import { resolveReportDateRange } from "@/lib/finance-report-utils"

function groupAttendanceByDay(rows: Array<{ date: Date; status: string }>, now: Date) {
  const byDay = new Map<string, { present: number; absent: number }>()
  for (const row of rows) {
    const dayKey = row.date.toISOString().slice(0, 10)
    const existing = byDay.get(dayKey) ?? { present: 0, absent: 0 }
    if (row.status === "PRESENT" || row.status === "LATE") existing.present++
    if (row.status === "ABSENT") existing.absent++
    byDay.set(dayKey, existing)
  }

  const weeklyAttendance: Array<{ label: string; present: number; absent: number }> = []
  let totalPresent = 0
  let totalAbsent = 0
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - offset)
    const dayKey = d.toISOString().slice(0, 10)
    const dayLabel = d.toLocaleDateString(undefined, { weekday: "short" })
    const day = byDay.get(dayKey) ?? { present: 0, absent: 0 }
    weeklyAttendance.push({ label: dayLabel, present: day.present, absent: day.absent })
    totalPresent += day.present
    totalAbsent += day.absent
  }

  const attendanceRate = totalPresent + totalAbsent > 0 ? (totalPresent / (totalPresent + totalAbsent)) * 100 : 0
  return { weeklyAttendance, attendanceRate }
}

function groupEnrollmentsByMonth(rows: Array<{ createdAt: Date }>, trendStart: Date) {
  const enrollmentMap = new Map<string, number>()
  for (const row of rows) {
    const key = `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, "0")}`
    enrollmentMap.set(key, (enrollmentMap.get(key) ?? 0) + 1)
  }

  const enrollmentTrends: Array<{ label: string; value: number }> = []
  for (let m = 0; m < 6; m++) {
    const dt = addMonths(trendStart, m)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
    const label = dt.toLocaleDateString(undefined, { month: "short" })
    enrollmentTrends.push({ label, value: enrollmentMap.get(key) ?? 0 })
  }
  return enrollmentTrends
}

export async function getAdminSystemReport(input: { period?: string | null; month?: string | null }) {
  const range = resolveReportDateRange({ period: input.period, month: input.month })
  const dateFilter = { gte: range.from, lte: range.to }
  const now = new Date()
  const monthStart = startOfMonth(now)
  const nextMonthStart = addMonths(monthStart, 1)
  const monthFilter = { gte: monthStart, lte: new Date(nextMonthStart.getTime() - 1) }

  const [
    totalStudents,
    totalTeachers,
    totalClasses,
    paidStudents,
    unpaidStudents,
    visitScheduledStudents,
    enrolledStudents,
    registrarsCount,
    financeUsersCount,
    partnersOverview,
    contractsOverview,
    financeReport,
  ] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: "TEACHER", isActive: true } }),
    prisma.class.count(),
    prisma.student.count({ where: { isActive: true, paymentStatus: "PAID" } }),
    prisma.student.count({ where: { isActive: true, paymentStatus: { in: ["UNPAID", "PARTIAL"] }, enrollmentStatus: "ENROLLED" } }),
    prisma.student.count({ where: { isActive: true, enrollmentStatus: "VISIT_SCHEDULED" } }),
    prisma.student.count({ where: { isActive: true, enrollmentStatus: "ENROLLED" } }),
    prisma.user.count({ where: { role: "REGISTRAR", isActive: true } }),
    prisma.user.count({ where: { role: "FINANCE", isActive: true } }),
    mapPartners(true).then((partners) => ({
      partners,
      monthlyDue: partners.reduce((sum, row) => sum + row.monthlyDue, 0),
      balanceDue: partners.reduce((sum, row) => sum + row.balanceDue, 0),
      totalPaidOut: partners.reduce((sum, row) => sum + row.totalPaidOut, 0),
    })),
    getContractsOverview(true),
    getFilteredFinanceReport({ period: input.period, month: input.month, category: "all" }),
  ])

  const [
    studentFeesAllTime,
    studentFeesPeriod,
    studentFeesThisMonth,
    teacherPayoutsPeriod,
    teacherPayoutsThisMonth,
    partnerPayoutsPeriod,
    partnerPayoutsThisMonth,
    manualIncomePeriod,
    manualExpensePeriod,
    unpaidStudentRows,
    visitScheduledRows,
    attendancePeriodRows,
    attendanceByClassRaw,
    enrollmentRows,
  ] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { paidAt: dateFilter }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { paidAt: monthFilter }, _sum: { amount: true } }),
    prisma.teacherContractPayout.aggregate({ where: { paidAt: dateFilter }, _sum: { amount: true } }),
    prisma.teacherContractPayout.aggregate({ where: { paidAt: monthFilter }, _sum: { amount: true } }),
    prisma.partnerPayout.aggregate({ where: { paidAt: dateFilter }, _sum: { amount: true } }),
    prisma.partnerPayout.aggregate({ where: { paidAt: monthFilter }, _sum: { amount: true } }),
    prisma.financeEntry.aggregate({ where: { type: "INCOME", occurredAt: dateFilter }, _sum: { amount: true } }),
    prisma.financeEntry.aggregate({ where: { type: "EXPENSE", occurredAt: dateFilter }, _sum: { amount: true } }),
    prisma.student.findMany({
      where: { isActive: true, paymentStatus: { in: ["UNPAID", "PARTIAL"] }, enrollmentStatus: "ENROLLED" },
      select: { id: true, firstName: true, lastName: true, phone: true, class: { select: { name: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 100,
    }),
    prisma.student.findMany({
      where: { isActive: true, enrollmentStatus: "VISIT_SCHEDULED" },
      select: { id: true, firstName: true, lastName: true, phone: true, visitDate: true, visitNote: true },
      orderBy: { visitDate: "asc" },
      take: 100,
    }),
    prisma.attendance.findMany({
      where: {
        date: {
          gte: (() => {
            const d = new Date(now)
            d.setHours(0, 0, 0, 0)
            d.setDate(d.getDate() - 6)
            return d
          })(),
          lte: now,
        },
      },
      select: { date: true, status: true },
    }),
    prisma.attendance.groupBy({
      by: ["classId", "status"],
      where: { date: dateFilter },
      _count: { _all: true },
    }),
    prisma.student.findMany({
      where: { createdAt: { gte: addMonths(startOfMonth(now), -5), lt: addMonths(startOfMonth(now), 1) } },
      select: { createdAt: true },
    }),
  ])

  const { weeklyAttendance, attendanceRate } = groupAttendanceByDay(attendancePeriodRows, now)
  const enrollmentTrends = groupEnrollmentsByMonth(enrollmentRows, addMonths(startOfMonth(now), -5))

  const classIds = Array.from(new Set(attendanceByClassRaw.map((r) => r.classId).filter(Boolean))) as string[]
  const classDocs = classIds.length
    ? await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
    : []
  const classNameMap = new Map(classDocs.map((c) => [c.id, c.name]))

  const attendanceByClassMap = new Map<string, { present: number; absent: number }>()
  for (const row of attendanceByClassRaw) {
    if (!row.classId) continue
    const entry = attendanceByClassMap.get(row.classId) ?? { present: 0, absent: 0 }
    if (row.status === "PRESENT" || row.status === "LATE") entry.present += row._count._all
    if (row.status === "ABSENT") entry.absent += row._count._all
    attendanceByClassMap.set(row.classId, entry)
  }

  const attendanceByClass = Array.from(attendanceByClassMap.entries())
    .map(([classId, stats]) => {
      const total = stats.present + stats.absent
      return {
        classId,
        className: classNameMap.get(classId) ?? "Unknown",
        present: stats.present,
        absent: stats.absent,
        total,
        absentRate: total > 0 ? Math.round((stats.absent / total) * 100) : 0,
      }
    })
    .sort((a, b) => b.absentRate - a.absentRate)

  const studentFeesPeriodAmount = Number(studentFeesPeriod._sum.amount ?? 0)
  const teacherPeriod = Number(teacherPayoutsPeriod._sum.amount ?? 0)
  const partnerPeriod = Number(partnerPayoutsPeriod._sum.amount ?? 0)
  const incomeManual = Number(manualIncomePeriod._sum.amount ?? 0)
  const expenseManual = Number(manualExpensePeriod._sum.amount ?? 0)
  const totalIncomePeriod = studentFeesPeriodAmount + incomeManual
  const totalExpensesPeriod = teacherPeriod + partnerPeriod + expenseManual

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
    },
    overview: {
      totalStudents,
      totalTeachers,
      totalClasses,
      enrolledStudents,
      visitScheduledStudents,
      paidStudents,
      unpaidStudents,
      registrarsCount,
      financeUsersCount,
      attendanceRate,
    },
    money: {
      studentFeesAllTime: Number(studentFeesAllTime._sum.amount ?? 0),
      studentFeesPeriod: studentFeesPeriodAmount,
      studentFeesThisMonth: Number(studentFeesThisMonth._sum.amount ?? 0),
      teacherPayoutsPeriod: teacherPeriod,
      teacherPayoutsThisMonth: Number(teacherPayoutsThisMonth._sum.amount ?? 0),
      partnerPayoutsPeriod: partnerPeriod,
      partnerPayoutsThisMonth: Number(partnerPayoutsThisMonth._sum.amount ?? 0),
      manualIncomePeriod: incomeManual,
      manualExpensePeriod: expenseManual,
      totalIncomePeriod,
      totalExpensesPeriod,
      netBalancePeriod: totalIncomePeriod - totalExpensesPeriod,
      teacherBalanceDue: contractsOverview.totals.balanceDue,
      partnerBalanceDue: partnersOverview.balanceDue,
    },
    payroll: {
      teachers: contractsOverview.teachers.map((t) => ({
        id: t.teacherId,
        name: t.teacherName,
        email: t.teacherEmail,
        monthlyPay: t.monthlyPay,
        totalPaidOut: t.totalPaidOut,
        balanceDue: t.balanceDue,
        contractsCount: t.contractsCount,
      })),
      partners: partnersOverview.partners.map((p) => ({
        id: p.id,
        name: p.name,
        monthlyDue: p.monthlyDue,
        totalPaidOut: p.totalPaidOut,
        balanceDue: p.balanceDue,
        studentsCount: p.studentsCount,
      })),
    },
    weeklyAttendance,
    enrollmentTrends,
    attendanceByClass,
    unpaidStudents: unpaidStudentRows.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      phone: s.phone,
      className: s.class?.name ?? null,
    })),
    visitScheduled: visitScheduledRows.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      phone: s.phone,
      visitDate: s.visitDate?.toISOString() ?? null,
      visitNote: s.visitNote,
    })),
    transactions: financeReport.lines,
    transactionTotals: financeReport.totals,
  }
}

export type AdminSystemReport = Awaited<ReturnType<typeof getAdminSystemReport>>
