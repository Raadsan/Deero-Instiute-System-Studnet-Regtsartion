import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageStudents, getSessionFromRequestCookies } from "@/lib/auth";
import { parseStudentEnrollmentInput } from "@/lib/student-enrollment";
import { sendVisitConfirmationWhatsApp } from "@/lib/visit-reminders";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { buildStudentSearchFilter } from "@/lib/student-search";
import type { Prisma } from "@/lib/generated/prisma/client";
import { nextStudentCode } from "@/lib/student-code";
import { getStudentFeeBalances, getStudentPaymentStatus, roundMoney } from "@/lib/student-fees";

function mapStudent(
  s: {
    id: string;
    studentCode: string | null;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    gender: string | null;
    feeAmount: number;
    paymentStatus: string;
    enrollmentStatus: string;
    visitDate: Date | null;
    visitNote: string | null;
    visitReminderSentAt: Date | null;
    isActive: boolean;
    classId: string | null;
    registeredById: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  classMap: Map<string, { id: string; name: string; level: string | null; isActive: boolean }>,
  registrarMap: Map<string, { id: string; name: string }>,
) {
  const classId = s.classId ?? null;
  const cls = classId ? classMap.get(classId) : null;
  const registeredById = s.registeredById ?? null;
  const registeredBy = registeredById ? registrarMap.get(registeredById) ?? null : null;
  return {
    id: s.id,
    studentCode: s.studentCode,
    firstName: s.firstName,
    lastName: s.lastName,
    phone: s.phone ?? null,
    email: s.email ?? null,
    gender: s.gender ?? null,
    feeAmount: Number(s.feeAmount ?? 0),
    paymentStatus: s.paymentStatus ?? "UNPAID",
    enrollmentStatus: s.enrollmentStatus ?? "ENROLLED",
    visitDate: s.visitDate ?? null,
    visitNote: s.visitNote ?? null,
    visitReminderSentAt: s.visitReminderSentAt ?? null,
    isActive: Boolean(s.isActive),
    classId,
    class: cls ?? null,
    registeredById,
    registeredBy,
    createdAt: s.createdAt ?? null,
    updatedAt: s.updatedAt ?? null,
  };
}

export async function GET(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canManageStudents(session.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const paymentStatus = searchParams.get("paymentStatus");
  const enrollmentStatus = searchParams.get("enrollmentStatus");
  const isActive = searchParams.get("isActive");
  const search = searchParams.get("search")?.trim() ?? "";
  const { page, pageSize, skip } = parsePagination(searchParams);

  const where: Prisma.StudentWhereInput = {};
  if (classId) where.classId = classId;
  if (paymentStatus) {
    if (paymentStatus !== "PAID" && paymentStatus !== "PARTIAL" && paymentStatus !== "UNPAID") {
      return NextResponse.json({ message: "Invalid paymentStatus" }, { status: 400 });
    }
    where.paymentStatus = paymentStatus;
  }
  if (enrollmentStatus) {
    if (enrollmentStatus !== "ENROLLED" && enrollmentStatus !== "VISIT_SCHEDULED") {
      return NextResponse.json({ message: "Invalid enrollmentStatus" }, { status: 400 });
    }
    where.enrollmentStatus = enrollmentStatus;
  }
  if (isActive === "true") where.isActive = true;
  if (isActive === "false") where.isActive = false;

  if (session.role === "REGISTRAR") {
    where.registeredById = session.userId;
  }

  const searchFilter = buildStudentSearchFilter(search);
  const finalWhere: Prisma.StudentWhereInput = searchFilter ? { AND: [where, searchFilter] } : where;

  const [total, students] = await Promise.all([
    prisma.student.count({ where: finalWhere }),
    prisma.student.findMany({
      where: finalWhere,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
  ]);

  const classIds = Array.from(
    new Set(students.map((s) => s.classId).filter((id): id is string => Boolean(id))),
  );

  const classes = classIds.length
    ? await prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true, level: true, isActive: true },
      })
    : [];

  const classMap = new Map<string, { id: string; name: string; level: string | null; isActive: boolean }>(
    classes.map((c) => [c.id, { id: c.id, name: c.name, level: c.level ?? null, isActive: Boolean(c.isActive) }]),
  );

  const registrarIds = Array.from(
    new Set(students.map((s) => s.registeredById).filter((id): id is string => Boolean(id))),
  );

  const registrars = registrarIds.length
    ? await prisma.user.findMany({
        where: { id: { in: registrarIds } },
        select: { id: true, name: true },
      })
    : [];

  const registrarMap = new Map<string, { id: string; name: string }>(
    registrars.map((r) => [r.id, { id: r.id, name: r.name }]),
  );

  const studentIds = students.map((s) => s.id)
  const paymentAgg = studentIds.length
    ? await prisma.payment.groupBy({
        by: ["studentId"],
        where: { studentId: { in: studentIds } },
        _sum: { amount: true },
        _count: { _all: true },
      })
    : []

  const latestPayments = studentIds.length
    ? await prisma.payment.findMany({
        where: { studentId: { in: studentIds } },
        select: { id: true, studentId: true },
        orderBy: [{ studentId: "asc" }, { paidAt: "desc" }, { createdAt: "desc" }],
        distinct: ["studentId"],
      })
    : []

  const paymentMap = new Map(
    paymentAgg.map((row) => [
      row.studentId,
      {
        totalPaid: Number(row._sum.amount ?? 0),
        paymentCount: row._count._all,
      },
    ]),
  )
  const latestPaymentMap = new Map(latestPayments.map((payment) => [payment.studentId, payment.id]))

  return NextResponse.json({
    items: students.map((s) => {
      const paymentStats = paymentMap.get(s.id)
      const balances = getStudentFeeBalances(s.feeAmount, paymentStats?.totalPaid ?? 0)
      return {
        ...mapStudent(s, classMap, registrarMap),
        ...balances,
        paymentCount: paymentStats?.paymentCount ?? 0,
        lastPaymentId: latestPaymentMap.get(s.id) ?? null,
      }
    }),
    pagination: buildPaginationMeta(page, pageSize, total),
  });
}

export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canManageStudents(session.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const classId = (body.classId as string | null | undefined) ?? null;
  let className: string | null = null;
  if (classId) {
    const cls = await prisma.class.findFirst({
      where: {
        id: classId,
        isActive: true,
        courses: { some: { status: { in: ["ACTIVE", "SCHEDULED"] } } },
      },
      select: { id: true, name: true },
    });
    if (!cls) {
      return NextResponse.json(
        { message: "Select a class with an active or upcoming course" },
        { status: 400 },
      );
    }
    className = cls.name;
  }

  const paymentAmountRaw = body.paymentAmount
  const paymentAmount =
    typeof paymentAmountRaw === "number"
      ? paymentAmountRaw
      : typeof paymentAmountRaw === "string"
        ? Number(paymentAmountRaw)
        : NaN
  const hasRegistrationPayment = Number.isFinite(paymentAmount) && paymentAmount > 0
  const paymentNote =
    typeof body.paymentNote === "string" && body.paymentNote.trim() ? body.paymentNote.trim() : null

  const feeAmountRaw = body.feeAmount
  const hasFeeAmount = feeAmountRaw !== undefined && feeAmountRaw !== null && feeAmountRaw !== ""
  const parsedFeeAmount = hasFeeAmount
    ? typeof feeAmountRaw === "number"
      ? feeAmountRaw
      : Number(feeAmountRaw)
    : hasRegistrationPayment
      ? paymentAmount
      : 0
  if (!Number.isFinite(parsedFeeAmount) || parsedFeeAmount < 0) {
    return NextResponse.json({ message: "feeAmount must be zero or a positive number" }, { status: 400 });
  }
  const feeAmount = roundMoney(parsedFeeAmount)
  let paymentStatus = getStudentPaymentStatus(feeAmount, hasRegistrationPayment ? paymentAmount : 0)

  const enrollment = parseStudentEnrollmentInput(body);
  if (!enrollment.ok) return NextResponse.json({ message: enrollment.message }, { status: 400 });

  if (enrollment.data.enrollmentStatus === "VISIT_SCHEDULED") {
    paymentStatus = "UNPAID"
  }

  const phone = body.phone ?? null;
  if (enrollment.data.enrollmentStatus === "VISIT_SCHEDULED" && !phone?.trim()) {
    return NextResponse.json({ message: "Phone number is required for visit scheduled students (WhatsApp)." }, { status: 400 });
  }

  const inserted = await prisma.$transaction(async (tx) => {
    const studentCode = await nextStudentCode(tx, className)
    const student = await tx.student.create({
      data: {
        studentCode,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: phone ?? null,
        email: body.email ?? null,
        gender: body.gender ?? null,
        feeAmount,
        paymentStatus,
        enrollmentStatus: enrollment.data.enrollmentStatus,
        visitDate: enrollment.data.visitDate,
        visitNote: enrollment.data.visitNote,
        visitReminderSentAt: null,
        isActive: true,
        classId,
        registeredById: session.userId,
      },
    })

    let paymentId: string | null = null
    if (hasRegistrationPayment && enrollment.data.enrollmentStatus !== "VISIT_SCHEDULED") {
      const balances = getStudentFeeBalances(feeAmount, paymentAmount)
      const payment = await tx.payment.create({
        data: {
          studentId: student.id,
          amount: paymentAmount,
          note: paymentNote ?? "Registration payment",
          recordedById: session.userId,
          feeAmountSnapshot: feeAmount,
          totalPaidSnapshot: balances.totalPaid,
          balanceSnapshot: balances.remainingBalance,
          statusSnapshot: paymentStatus,
        },
      })
      paymentId = payment.id
    }

    return { student, paymentId }
  })

  const studentId = inserted.student.id;

  let whatsappConfirmation: { status: string; error?: string } | null = null;
  if (enrollment.data.enrollmentStatus === "VISIT_SCHEDULED" && enrollment.data.visitDate && phone?.trim()) {
    try {
      const result = await sendVisitConfirmationWhatsApp({
        studentId,
        phone,
        firstName: body.firstName,
        visitDate: enrollment.data.visitDate,
        initiatedBy: session.userId,
      });
      whatsappConfirmation = {
        status: result.status,
        error: "error" in result ? result.error : undefined,
      };
    } catch (e: unknown) {
      whatsappConfirmation = {
        status: "FAILED",
        error: e instanceof Error ? e.message : "WhatsApp not configured",
      };
    }
  }

  return NextResponse.json(
    {
      id: studentId,
      studentCode: inserted.student.studentCode,
      paymentId: inserted.paymentId,
      ...body,
      feeAmount,
      paymentStatus,
      enrollmentStatus: enrollment.data.enrollmentStatus,
      visitDate: enrollment.data.visitDate,
      visitNote: enrollment.data.visitNote,
      registeredById: session.userId,
      whatsappConfirmation,
    },
    { status: 201 },
  );
}
