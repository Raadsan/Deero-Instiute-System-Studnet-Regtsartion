import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import { buildPaginationMeta, parsePagination } from "@/lib/pagination"
import { mapRecordedBy, recordedBySelect } from "@/lib/recorded-by"
import { getStudentFeeBalances, getStudentPaymentStatus, roundMoney } from "@/lib/student-fees"
import type { Prisma } from "@/lib/generated/prisma/client"

type PaymentRow = {
  id: string
  amount: number
  currency: string
  paidAt: string
  note: string | null
  recordedBy: ReturnType<typeof mapRecordedBy>
  student: {
    id: string
    firstName: string
    lastName: string
    class: { id: string; name: string; level: string | null } | null
  } | null
}

export async function GET(req: Request) {
  const session = await getSessionFromRequestCookies()
  const auth = requireFinanceSession(session)
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const { page, pageSize, skip } = parsePagination(searchParams)
  const classId = searchParams.get("classId")
  const studentId = searchParams.get("studentId")
  const search = searchParams.get("search")?.trim() ?? ""

  const where: Prisma.PaymentWhereInput = {}
  if (studentId) where.studentId = studentId
  if (classId) where.student = { classId, isActive: true }
  if (search) {
    where.OR = [
      { note: { contains: search, mode: "insensitive" } },
      { student: { firstName: { contains: search, mode: "insensitive" } } },
      { student: { lastName: { contains: search, mode: "insensitive" } } },
    ]
  }

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      skip,
      take: pageSize,
      include: { recordedBy: { select: recordedBySelect } },
    }),
  ])
  const studentIds = Array.from(
    new Set(payments.map((p) => p.studentId).filter((x): x is string => Boolean(x))),
  )

  const students = studentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, classId: true },
      })
    : []

  const classIds = Array.from(
    new Set(students.map((s) => s.classId).filter((x): x is string => Boolean(x))),
  )

  const classes = classIds.length
    ? await prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true, level: true },
      })
    : []

  const classMap = new Map<string, { id: string; name: string; level: string | null }>(
    classes.map((c) => [c.id, { id: c.id, name: c.name, level: c.level ?? null }]),
  )

  const studentMap = new Map<string, { id: string; firstName: string; lastName: string; class: { id: string; name: string; level: string | null } | null }>(
    students.map((s) => {
      const clsId = s.classId ?? null
      return [s.id, { id: s.id, firstName: s.firstName, lastName: s.lastName, class: clsId ? classMap.get(clsId) ?? null : null }]
    }),
  )

  const rows: PaymentRow[] = payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount ?? 0),
    currency: p.currency ?? "USD",
    paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : new Date(p.createdAt).toISOString(),
    note: p.note ?? null,
    recordedBy: mapRecordedBy(p.recordedBy),
    student: studentMap.get(p.studentId) ?? null,
  }))

  return NextResponse.json({
    items: rows,
    pagination: buildPaginationMeta(page, pageSize, total),
  })
}

export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies()
  const auth = requireFinanceSession(session)
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { studentId, amount, feeAmount, currency, note, paidAt } = body as {
    studentId?: unknown
    amount?: unknown
    feeAmount?: unknown
    currency?: unknown
    note?: unknown
    paidAt?: unknown
  }

  if (typeof studentId !== "string" || !studentId) {
    return NextResponse.json({ message: "studentId is required" }, { status: 400 })
  }

  const numericAmount = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return NextResponse.json({ message: "amount must be a positive number" }, { status: 400 })
  }

  const hasFeeAmount = feeAmount !== undefined && feeAmount !== null && feeAmount !== ""
  const numericFeeAmount = hasFeeAmount ? (typeof feeAmount === "number" ? feeAmount : Number(feeAmount)) : null
  if (hasFeeAmount && (!Number.isFinite(numericFeeAmount) || Number(numericFeeAmount) <= 0)) {
    return NextResponse.json({ message: "feeAmount must be a positive number" }, { status: 400 })
  }

  const parsedPaidAt = typeof paidAt === "string" ? new Date(paidAt) : paidAt instanceof Date ? paidAt : new Date()
  if (Number.isNaN(parsedPaidAt.getTime())) return NextResponse.json({ message: "Invalid paidAt" }, { status: 400 })

  const paymentCurrency = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD"
  const paymentNote = typeof note === "string" && note.trim() ? note.trim() : null

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, feeAmount: true } })
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 })

  const accountFeeAmount = roundMoney(numericFeeAmount ?? student.feeAmount)
  if (accountFeeAmount <= 0) {
    return NextResponse.json(
      { message: "Set the student's total fee before recording a payment" },
      { status: 400 },
    )
  }

  const inserted = await prisma.$transaction(async (tx) => {
    const paymentTotalBefore = await tx.payment.aggregate({
      where: { studentId },
      _sum: { amount: true },
    })
    const totalPaid = roundMoney(Number(paymentTotalBefore._sum.amount ?? 0) + numericAmount)
    const paymentStatus = getStudentPaymentStatus(accountFeeAmount, totalPaid)
    const balances = getStudentFeeBalances(accountFeeAmount, totalPaid)

    const payment = await tx.payment.create({
      data: {
        studentId,
        amount: numericAmount,
        currency: paymentCurrency,
        note: paymentNote,
        paidAt: parsedPaidAt,
        recordedById: auth.session.userId,
        feeAmountSnapshot: accountFeeAmount,
        totalPaidSnapshot: totalPaid,
        balanceSnapshot: balances.remainingBalance,
        statusSnapshot: paymentStatus,
      },
    })

    await tx.student.update({
      where: { id: studentId },
      data: { feeAmount: accountFeeAmount, paymentStatus },
    })

    return { payment, totalPaid, paymentStatus }
  })

  const balances = getStudentFeeBalances(accountFeeAmount, inserted.totalPaid)

  return NextResponse.json(
    {
      id: inserted.payment.id,
      studentId,
      amount: roundMoney(numericAmount),
      currency: paymentCurrency,
      note: paymentNote,
      paidAt: parsedPaidAt.toISOString(),
      paymentStatus: inserted.paymentStatus,
      ...balances,
    },
    { status: 201 },
  )
}

export async function PATCH(req: Request) {
  const session = await getSessionFromRequestCookies()
  const auth = requireFinanceSession(session)
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { studentId, feeAmount } = body as { studentId?: unknown; feeAmount?: unknown }
  if (typeof studentId !== "string" || !studentId) {
    return NextResponse.json({ message: "studentId is required" }, { status: 400 })
  }

  const numericFeeAmount = typeof feeAmount === "number" ? feeAmount : Number(feeAmount)
  if (!Number.isFinite(numericFeeAmount) || numericFeeAmount <= 0) {
    return NextResponse.json({ message: "feeAmount must be a positive number" }, { status: 400 })
  }

  const accountFeeAmount = roundMoney(numericFeeAmount)
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } })
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 })

  const paymentTotal = await prisma.payment.aggregate({ where: { studentId }, _sum: { amount: true } })
  const totalPaid = roundMoney(Number(paymentTotal._sum.amount ?? 0))
  const paymentStatus = getStudentPaymentStatus(accountFeeAmount, totalPaid)

  await prisma.student.update({
    where: { id: studentId },
    data: { feeAmount: accountFeeAmount, paymentStatus },
  })

  return NextResponse.json({
    studentId,
    paymentStatus,
    ...getStudentFeeBalances(accountFeeAmount, totalPaid),
  })
}
