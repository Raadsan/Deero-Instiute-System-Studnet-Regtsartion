import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageStudents, getSessionFromRequestCookies } from "@/lib/auth";
import { idsMatch } from "@/lib/mongo-id";
import { parseStudentEnrollmentInput } from "@/lib/student-enrollment";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 });

  const classId = student.classId ?? null;
  const cls = classId
    ? await prisma.class
        .findUnique({
          where: { id: classId },
          select: { id: true, name: true, level: true, isActive: true },
        })
        .then((c) => (c ? { id: c.id, name: c.name, level: c.level ?? null, isActive: Boolean(c.isActive) } : null))
        .catch(() => null)
    : null;

  const [payments, attendances] = await Promise.all([
    prisma.payment.findMany({ where: { studentId: id }, orderBy: { paidAt: "desc" } }),
    prisma.attendance.findMany({ where: { studentId: id }, orderBy: { date: "desc" } }),
  ]);

  return NextResponse.json({
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    phone: student.phone ?? null,
    email: student.email ?? null,
    gender: student.gender ?? null,
    paymentStatus: student.paymentStatus ?? "UNPAID",
    enrollmentStatus: student.enrollmentStatus ?? "ENROLLED",
    visitDate: student.visitDate ?? null,
    visitNote: student.visitNote ?? null,
    visitReminderSentAt: student.visitReminderSentAt ?? null,
    isActive: Boolean(student.isActive),
    classId,
    class: cls ?? null,
    payments,
    attendances,
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!canManageStudents(session.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const classId = (body.classId as string | null | undefined) ?? null;
  if (classId) {
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
    if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 400 });
  }

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ message: "Student not found" }, { status: 404 });

  if (session.role === "REGISTRAR" && !idsMatch(existing.registeredById, session.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const enrollment = parseStudentEnrollmentInput(body, {
    enrollmentStatus: existing.enrollmentStatus,
    visitDate: existing.visitDate ?? null,
    visitNote: existing.visitNote ?? null,
    visitReminderSentAt: existing.visitReminderSentAt ?? null,
  });
  if (!enrollment.ok) return NextResponse.json({ message: enrollment.message }, { status: 400 });

  const phone = body.phone ?? null;
  if (enrollment.data.enrollmentStatus === "VISIT_SCHEDULED" && !phone?.trim()) {
    return NextResponse.json({ message: "Phone number is required for visit scheduled students (WhatsApp)." }, { status: 400 });
  }

  const isRegistrar = session.role === "REGISTRAR";
  const paymentStatus = isRegistrar
    ? (existing.paymentStatus ?? "UNPAID")
    : (body.paymentStatus ?? "UNPAID");
  if (paymentStatus !== "PAID" && paymentStatus !== "UNPAID") {
    return NextResponse.json({ message: "Invalid paymentStatus" }, { status: 400 });
  }

  const isActive = isRegistrar
    ? Boolean(existing.isActive)
    : typeof body.isActive === "boolean"
      ? body.isActive
      : Boolean(body.isActive);

  const updated = await prisma.student.update({
    where: { id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: phone ?? null,
      email: body.email ?? null,
      gender: body.gender ?? null,
      paymentStatus,
      enrollmentStatus: enrollment.data.enrollmentStatus,
      visitDate: enrollment.data.visitDate,
      visitNote: enrollment.data.visitNote,
      visitReminderSentAt: enrollment.data.visitReminderSentAt ?? null,
      classId,
      isActive,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 });

  await Promise.all([
    prisma.payment.deleteMany({ where: { studentId: id } }),
    prisma.attendance.deleteMany({ where: { studentId: id } }),
  ]);

  await prisma.student.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
