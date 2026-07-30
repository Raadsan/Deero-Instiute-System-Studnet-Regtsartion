import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { mapRecordedBy, recordedBySelect } from "@/lib/recorded-by"
import type { Prisma } from "@/lib/generated/prisma/client"

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1, 0, 0, 0, 0)
}

export async function GET(req: Request) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN" && session.role !== "FINANCE") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get("classId")
  const paymentStatus = searchParams.get("paymentStatus")

  if (paymentStatus && paymentStatus !== "PAID" && paymentStatus !== "UNPAID") {
    return NextResponse.json({ message: "Invalid paymentStatus" }, { status: 400 })
  }
  const normalizedPaymentStatus = paymentStatus as "PAID" | "UNPAID" | null

  const studentWhere: Prisma.StudentWhereInput = { isActive: true }
  if (classId) studentWhere.classId = classId
  if (normalizedPaymentStatus) studentWhere.paymentStatus = normalizedPaymentStatus

  const paymentWhere: Prisma.PaymentWhereInput = {}
  if (classId || normalizedPaymentStatus) {
    paymentWhere.student = {
      isActive: true,
      ...(classId ? { classId } : {}),
      ...(normalizedPaymentStatus ? { paymentStatus: normalizedPaymentStatus } : {}),
    }
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const nextMonthStart = addMonths(monthStart, 1)

  const [
    classes,
    students,
    payments,
    paymentAggByStudent,
    totalAgg,
    monthlyAgg,
    paymentCount,
    allStudentsForClassStats,
    allPaymentsForClassStats,
  ] = await Promise.all([
    prisma.class.findMany({
      where: { isActive: true },
      select: { id: true, name: true, level: true },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        paymentStatus: true,
        classId: true,
        class: { select: { id: true, name: true, level: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.payment.findMany({
      where: paymentWhere,
      select: {
        id: true,
        amount: true,
        currency: true,
        paidAt: true,
        note: true,
        studentId: true,
        recordedBy: { select: recordedBySelect },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            paymentStatus: true,
            class: { select: { id: true, name: true, level: true } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
      take: 200,
    }),
    prisma.payment.groupBy({
      by: ["studentId"],
      where: paymentWhere,
      _sum: { amount: true },
      _count: { _all: true },
      _max: { paidAt: true },
    }),
    prisma.payment.aggregate({ where: paymentWhere, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { ...paymentWhere, paidAt: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: paymentWhere }),
    prisma.student.groupBy({
      by: ["classId", "paymentStatus"],
      where: { isActive: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ classId: string | null; total: number; count: bigint }>>`
      SELECT s."classId", COALESCE(SUM(p.amount), 0)::float AS total, COUNT(p.id) AS count
      FROM "Payment" p
      INNER JOIN "Student" s ON p."studentId" = s.id
      WHERE s."isActive" = true
      GROUP BY s."classId"
    `,
  ])

  const studentPaymentMap = new Map(
    paymentAggByStudent.map((row) => [
      row.studentId,
      {
        totalPaid: Number(row._sum.amount ?? 0),
        paymentCount: row._count._all,
        lastPaidAt: row._max.paidAt ? row._max.paidAt.toISOString() : null,
      },
    ]),
  )

  const classNameMap = new Map(classes.map((c) => [c.id, c.name]))
  classNameMap.set("__none__", "No Class")

  type ClassBucket = {
    classId: string | null
    className: string
    totalCollected: number
    paymentCount: number
    paidStudents: number
    unpaidStudents: number
    totalStudents: number
  }

  const classBuckets = new Map<string, ClassBucket>()

  for (const cls of classes) {
    classBuckets.set(cls.id, {
      classId: cls.id,
      className: cls.name,
      totalCollected: 0,
      paymentCount: 0,
      paidStudents: 0,
      unpaidStudents: 0,
      totalStudents: 0,
    })
  }

  classBuckets.set("__none__", {
    classId: null,
    className: "No Class",
    totalCollected: 0,
    paymentCount: 0,
    paidStudents: 0,
    unpaidStudents: 0,
    totalStudents: 0,
  })

  for (const row of allStudentsForClassStats) {
    const key = row.classId ?? "__none__"
    const bucket = classBuckets.get(key)
    if (!bucket) continue
    bucket.totalStudents += row._count._all
    if (row.paymentStatus === "PAID") bucket.paidStudents += row._count._all
    else bucket.unpaidStudents += row._count._all
  }

  for (const row of allPaymentsForClassStats) {
    const key = row.classId ?? "__none__"
    const bucket = classBuckets.get(key)
    if (!bucket) continue
    bucket.totalCollected += Number(row.total ?? 0)
    bucket.paymentCount += Number(row.count ?? 0)
  }

  const byClass = Array.from(classBuckets.values())
    .filter((row) => row.totalStudents > 0 || row.totalCollected > 0)
    .sort((a, b) => b.totalCollected - a.totalCollected)

  const studentLedgers = students.map((student) => {
    const stats = studentPaymentMap.get(student.id)
    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      paymentStatus: student.paymentStatus,
      class: student.class ?? null,
      totalPaid: stats?.totalPaid ?? 0,
      paymentCount: stats?.paymentCount ?? 0,
      lastPaidAt: stats?.lastPaidAt ?? null,
    }
  })

  const paidStudents = students.filter((s) => s.paymentStatus === "PAID").length
  const unpaidStudents = students.filter((s) => s.paymentStatus === "UNPAID").length

  const recentPayments = payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount ?? 0),
    currency: p.currency ?? "USD",
    paidAt: p.paidAt.toISOString(),
    note: p.note ?? null,
    recordedBy: mapRecordedBy(p.recordedBy),
    student: p.student
      ? {
          id: p.student.id,
          firstName: p.student.firstName,
          lastName: p.student.lastName,
          paymentStatus: p.student.paymentStatus,
          class: p.student.class ?? null,
        }
      : null,
  }))

  return NextResponse.json({
    totals: {
      totalCollected: Number(totalAgg._sum.amount ?? 0),
      monthlyCollected: Number(monthlyAgg._sum.amount ?? 0),
      paymentCount,
      paidStudents,
      unpaidStudents,
      totalStudents: students.length,
    },
    byClass,
    studentLedgers,
    recentPayments,
    classes: classes.map((c) => ({ id: c.id, name: c.name, level: c.level })),
  })
}
