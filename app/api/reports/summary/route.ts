// GET /api/reports/summary
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"

type ChartPoint = { label: string; value: number }
type WeeklyAttendancePoint = { label: string; present: number; absent: number }

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1, 0, 0, 0, 0)
}

function groupAttendanceByDay(
  rows: Array<{ date: Date; status: string }>,
  now: Date,
): { weeklyAttendance: WeeklyAttendancePoint[]; attendanceRate: number } {
  const byDay = new Map<string, { present: number; absent: number }>()
  for (const row of rows) {
    const dayKey = row.date.toISOString().slice(0, 10)
    const existing = byDay.get(dayKey) ?? { present: 0, absent: 0 }
    if (row.status === "PRESENT") existing.present++
    if (row.status === "ABSENT") existing.absent++
    byDay.set(dayKey, existing)
  }

  const weeklyAttendance: WeeklyAttendancePoint[] = []
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

function groupEnrollmentsByMonth(
  rows: Array<{ createdAt: Date }>,
  trendStart: Date,
): ChartPoint[] {
  const enrollmentMap = new Map<string, number>()
  for (const row of rows) {
    const key = `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, "0")}`
    enrollmentMap.set(key, (enrollmentMap.get(key) ?? 0) + 1)
  }

  const enrollmentTrends: ChartPoint[] = []
  for (let m = 0; m < 6; m++) {
    const dt = addMonths(trendStart, m)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
    const label = dt.toLocaleDateString(undefined, { month: "short" })
    enrollmentTrends.push({ label, value: enrollmentMap.get(key) ?? 0 })
  }
  return enrollmentTrends
}

export async function GET() {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: "TEACHER", isActive: true } }),
    prisma.class.count(),
  ])

  const [paidStudents, unpaidStudents] = await Promise.all([
    prisma.student.count({ where: { isActive: true, paymentStatus: "PAID" } }),
    prisma.student.count({ where: { isActive: true, paymentStatus: "UNPAID" } }),
  ])

  const now = new Date()
  const monthStart = startOfMonth(now)
  const nextMonthStart = addMonths(monthStart, 1)
  const lastMonthStart = addMonths(monthStart, -1)

  const [currentRevenue, lastRevenue] = await Promise.all([
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: lastMonthStart, lt: monthStart } },
      _sum: { amount: true },
    }),
  ])

  const monthlyRevenue = currentRevenue._sum.amount ? Number(currentRevenue._sum.amount) : 0
  const lastMonthRevenue = lastRevenue._sum.amount ? Number(lastRevenue._sum.amount) : 0

  const largestClassesAgg = await prisma.student.groupBy({
    by: ["classId"],
    _count: { _all: true },
    orderBy: { _count: { classId: "desc" } },
    take: 3,
  })

  const absenceStats = await prisma.attendance.groupBy({
    by: ["classId", "status"],
    _count: { _all: true },
  })

  const absenceByClass = new Map<string, { present: number; absent: number }>()
  for (const row of absenceStats) {
    if (!row.classId) continue
    const entry = absenceByClass.get(row.classId) ?? { present: 0, absent: 0 }
    if (row.status === "PRESENT") entry.present += row._count._all
    if (row.status === "ABSENT") entry.absent += row._count._all
    absenceByClass.set(row.classId, entry)
  }

  const absenceRateAgg = Array.from(absenceByClass.entries())
    .map(([classId, stats]) => {
      const total = stats.present + stats.absent
      const absentRate = total > 0 ? (stats.absent / total) * 100 : 0
      return { classId, absentRate }
    })
    .sort((a, b) => b.absentRate - a.absentRate)
    .slice(0, 3)

  const classIdsToFetch = Array.from(
    new Set([
      ...largestClassesAgg.map((c) => c.classId).filter(Boolean),
      ...absenceRateAgg.map((c) => c.classId),
    ]),
  ) as string[]

  const classDocs = classIdsToFetch.length
    ? await prisma.class.findMany({ where: { id: { in: classIdsToFetch } }, select: { id: true, name: true } })
    : []

  const classLookup = new Map(classDocs.map((c) => [c.id, c.name]))

  const largestClasses = largestClassesAgg
    .filter((c) => c.classId)
    .map((c) => ({
      name: classLookup.get(c.classId!) || "Unknown",
      students: c._count._all,
    }))

  const highestAbsenceClasses = absenceRateAgg.map((c) => ({
    name: classLookup.get(c.classId) || "Unknown",
    rate: Math.round(c.absentRate),
  }))

  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - 6)
  const weekEnd = new Date(now)
  weekEnd.setHours(0, 0, 0, 0)
  weekEnd.setDate(weekEnd.getDate() + 1)

  const weekAttendanceRows = await prisma.attendance.findMany({
    where: { date: { gte: weekStart, lt: weekEnd } },
    select: { date: true, status: true },
  })

  const { weeklyAttendance, attendanceRate } = groupAttendanceByDay(weekAttendanceRows, now)

  const trendStart = addMonths(startOfMonth(now), -5)
  const trendEnd = addMonths(startOfMonth(now), 1)

  const enrollmentRows = await prisma.student.findMany({
    where: { createdAt: { gte: trendStart, lt: trendEnd } },
    select: { createdAt: true },
  })

  const enrollmentTrends = groupEnrollmentsByMonth(enrollmentRows, trendStart)

  return NextResponse.json({
    totalStudents,
    totalTeachers,
    totalClasses,
    attendanceRate,
    paidStudents,
    unpaidStudents,
    monthlyRevenue,
    lastMonthRevenue,
    largestClasses,
    highestAbsenceClasses,
    weeklyAttendance,
    enrollmentTrends,
  })
}
