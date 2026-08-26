import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { parseScheduleDays } from "@/lib/class-schedule";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const cls = await prisma.class.findUnique({ where: { id } });

  if (!cls) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  const teacherId = cls.teacherId ?? null;
  let teacher: { id: string; name: string; email: string } | null = null;
  if (teacherId) {
    const t = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true, email: true },
    });
    teacher = t ? { id: t.id, name: t.name, email: t.email } : null;
  }

  const shiftId = cls.shiftId ?? null;
  let shift: { id: string; name: string; startTime: string | null; endTime: string | null; isActive: boolean } | null = null;
  if (shiftId) {
    const s = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { id: true, name: true, startTime: true, endTime: true, isActive: true },
    });
    shift = s
      ? {
          id: s.id,
          name: s.name,
          startTime: s.startTime ?? null,
          endTime: s.endTime ?? null,
          isActive: Boolean(s.isActive),
        }
      : null;
  }

  const students = await prisma.student.findMany({
    where: { classId: cls.id, isHidden: false },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    id: cls.id,
    name: cls.name,
    level: cls.level ?? null,
    isActive: Boolean(cls.isActive),
    teacherId,
    teacher: teacher ?? null,
    shiftId,
    shift: shift ?? null,
    scheduleDays: cls.scheduleDays ?? [],
    students,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const teacherId = body.teacherId ?? null;
  if (teacherId) {
    if (typeof teacherId !== "string") return NextResponse.json({ message: "Invalid teacherId" }, { status: 400 });
  }

  if (teacherId) {
    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { role: true, isActive: true },
    });
    if (!teacher || !teacher.isActive || teacher.role !== "TEACHER") {
      return NextResponse.json({ message: "Teacher not found" }, { status: 400 });
    }
  }

  const shiftId = body.shiftId ?? null;
  if (shiftId) {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { isActive: true },
    });
    if (!shift || !shift.isActive) {
      return NextResponse.json({ message: "Shift not found" }, { status: 400 });
    }
  }

  try {
    const scheduleDays =
      body.scheduleDays !== undefined ? parseScheduleDays(body.scheduleDays) : undefined;
    if (body.scheduleDays !== undefined && !scheduleDays) {
      return NextResponse.json({ message: "Select at least one class day" }, { status: 400 });
    }

    const updated = await prisma.class.update({
      where: { id },
      data: {
        name: body.name,
        level: body.level ?? null,
        teacherId,
        shiftId,
        ...(scheduleDays !== undefined ? { scheduleDays } : {}),
        isActive: typeof body.isActive === "boolean" ? body.isActive : Boolean(body.isActive),
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      level: updated.level ?? null,
      isActive: Boolean(updated.isActive),
      teacherId,
      shiftId,
      scheduleDays: updated.scheduleDays ?? [],
    });
  } catch {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const cls = await prisma.class.findUnique({ where: { id }, select: { id: true } });
  if (!cls) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  await prisma.student.updateMany({ where: { classId: id }, data: { classId: null } });
  await prisma.class.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
