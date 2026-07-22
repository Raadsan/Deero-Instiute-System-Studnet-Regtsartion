import { prisma } from "@/lib/prisma"
import { getContractsOverview } from "@/lib/contract-service"
import { mapPartners } from "@/lib/partner-service"
import { addMonths, startOfMonth } from "@/lib/finance-utils"

export async function getFinanceSummary() {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const nextMonthStart = addMonths(monthStart, 1)

  const [
    studentFeesTotal,
    studentFeesMonthly,
    unpaidStudents,
    partnersOverview,
    contractsOverview,
    staffRows,
    staffPayoutTotal,
    manualIncome,
    manualExpenses,
    classPaymentStats,
  ] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
    prisma.student.count({ where: { isActive: true, paymentStatus: "UNPAID" } }),
    mapPartners(true).then((partners) => ({
      partners,
      monthlyDue: partners.reduce((sum, row) => sum + row.monthlyDue, 0),
      balanceDue: partners.reduce((sum, row) => sum + row.balanceDue, 0),
      totalPaidOut: partners.reduce((sum, row) => sum + row.totalPaidOut, 0),
    })),
    getContractsOverview(true),
    prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.staffSalaryPayout.aggregate({ _sum: { amount: true } }),
    prisma.financeEntry.aggregate({
      where: { type: "INCOME" },
      _sum: { amount: true },
    }),
    prisma.financeEntry.aggregate({
      where: { type: "EXPENSE" },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<Array<{ classId: string | null; total: number; count: bigint }>>`
      SELECT s."classId", COALESCE(SUM(p.amount), 0)::float AS total, COUNT(p.id) AS count
      FROM "Payment" p
      INNER JOIN "Student" s ON p."studentId" = s.id
      WHERE s."isActive" = true
      GROUP BY s."classId"
    `,
  ])

  const staffPayoutsByStaff = await prisma.staffSalaryPayout.groupBy({
    by: ["staffId"],
    _sum: { amount: true },
  })
  const staffPaidMap = new Map(staffPayoutsByStaff.map((row) => [row.staffId, row._sum.amount ?? 0]))

  const staff = staffRows.map((member) => {
    const totalPaidOut = staffPaidMap.get(member.id) ?? 0
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
    }
  })

  const staffMonthlyPayroll = staff.reduce((sum, row) => sum + row.monthlySalary, 0)
  const staffBalanceDue = staff.reduce((sum, row) => sum + row.balanceDue, 0)

  const classMeta = await prisma.class.findMany({
    where: { isActive: true },
    select: { id: true, name: true, level: true },
  })
  const classMetaMap = new Map(classMeta.map((row) => [row.id, row]))

  const classRevenueMap = new Map<string, { classId: string; className: string; classLevel: string | null; totalCollected: number }>()

  for (const row of classPaymentStats) {
    const classId = row.classId ?? "__none__"
    const meta = classId === "__none__" ? null : classMetaMap.get(classId)
    const existing = classRevenueMap.get(classId) ?? {
      classId: classId === "__none__" ? "" : classId,
      className: meta?.name ?? "No Class",
      classLevel: meta?.level ?? null,
      totalCollected: 0,
    }
    existing.totalCollected += Number(row.total ?? 0)
    classRevenueMap.set(classId, existing)
  }

  const revenueByClass = Array.from(classRevenueMap.values()).sort((a, b) => b.totalCollected - a.totalCollected)

  const studentRevenue = Number(studentFeesTotal._sum.amount ?? 0)
  const studentRevenueMonthly = Number(studentFeesMonthly._sum.amount ?? 0)
  const otherIncome = Number(manualIncome._sum.amount ?? 0)
  const totalExpenses =
    Number(manualExpenses._sum.amount ?? 0) +
    partnersOverview.totalPaidOut +
    contractsOverview.totals.totalPaidOut +
    Number(staffPayoutTotal._sum.amount ?? 0)

  const totalIncome = studentRevenue + otherIncome
  const outstandingPayables =
    partnersOverview.balanceDue + contractsOverview.totals.balanceDue + staffBalanceDue

  return {
    overview: {
      totalIncome,
      incomeThisMonth: studentRevenueMonthly,
      manualIncome: otherIncome,
      manualExpenses: Number(manualExpenses._sum.amount ?? 0),
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      outstandingPayables,
      unpaidStudents,
    },
    studentFees: {
      totalCollected: studentRevenue,
      monthlyCollected: studentRevenueMonthly,
      unpaidStudents,
      byClass: revenueByClass,
    },
    partners: {
      monthlyDue: partnersOverview.monthlyDue,
      balanceDue: partnersOverview.balanceDue,
      totalPaidOut: partnersOverview.totalPaidOut,
      count: partnersOverview.partners.length,
    },
    teacherPayroll: {
      monthlyPay: contractsOverview.totals.monthlyPay,
      balanceDue: contractsOverview.totals.balanceDue,
      totalPaidOut: contractsOverview.totals.totalPaidOut,
      teachersCount: contractsOverview.totals.teachersCount,
    },
    staffPayroll: {
      monthlyPayroll: staffMonthlyPayroll,
      balanceDue: staffBalanceDue,
      totalPaidOut: Number(staffPayoutTotal._sum.amount ?? 0),
      staffCount: staff.length,
      staff,
    },
  }
}
