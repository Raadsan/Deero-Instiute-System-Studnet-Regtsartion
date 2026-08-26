import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { parseScheduleDays } from "@/lib/class-schedule";

async function validateShiftId(shiftId: string | null) {
  if (!shiftId) return null;
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: { id: true, name: true, startTime: true, endTime: true, isActive: true },
  });
  if (!shift || !shift.isActive) {
    return { error: NextResponse.json({ message: "Shift not found" }, { status: 400 }) };
  }
  return {
    shift: {
      id: shift.id,
      name: shift.name,
      startTime: shift.startTime ?? null,
      endTime: shift.endTime ?? null,
      isActive: Boolean(shift.isActive),
    },
  };
}

function mapClassRow(
  cls: {
    id: string;
    name: string;
    level?: string | null;
    isActive?: boolean;
    teacherId?: string | null;
    shiftId?: string | null;
    scheduleDays?: number[];
  },
  countMap: Map<string, number>,
  teacherMap: Map<string, { id: string; name: string; email: string }>,
  shiftMap: Map<string, { id: string; name: string; startTime: string | null; endTime: string | null; isActive: boolean }>,
) {
  const id = cls.id;
  const tid = cls.teacherId ?? null;
  const sid = cls.shiftId ?? null;
  return {
    id,
    name: cls.name,
    level: cls.level ?? null,
    isActive: Boolean(cls.isActive),
    teacherId: tid,
    teacher: tid ? teacherMap.get(tid) ?? null : null,
    shiftId: sid,
    shift: sid ? shiftMap.get(sid) ?? null : null,
    scheduleDays: cls.scheduleDays ?? [],
    studentsCount: countMap.get(id) ?? 0,
  };
}

// GET /api/classes
export async function GET(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN" && session.role !== "REGISTRAR" && session.role !== "FINANCE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const assignmentEligible = searchParams.get("assignmentEligible") === "true";

  const classes = await prisma.class.findMany({
    where: assignmentEligible
      ? {
          isActive: true,
          courses: { some: { status: { in: ["ACTIVE", "SCHEDULED"] } } },
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });

  const classIds = classes.map((c) => c.id);

  const counts = classIds.length
    ? await prisma.student.groupBy({
        by: ["classId"],
        where: { classId: { in: classIds }, isHidden: false },
        _count: { _all: true },
      })
    : [];

  const countMap = new Map<string, number>(
    counts.filter((r) => r.classId).map((r) => [r.classId!, r._count._all]),
  );

  const teacherIdStrings = Array.from(
    new Set(classes.map((c) => c.teacherId).filter((id): id is string => Boolean(id))),
  );

  const teachers = teacherIdStrings.length
    ? await prisma.user.findMany({
        where: { id: { in: teacherIdStrings } },
        select: { id: true, name: true, email: true },
      })
    : [];

  const teacherMap = new Map<string, { id: string; name: string; email: string }>(
    teachers.map((t) => [t.id, { id: t.id, name: t.name, email: t.email }]),
  );

  const shiftIdStrings = Array.from(
    new Set(classes.map((c) => c.shiftId).filter((id): id is string => Boolean(id))),
  );

  const shifts = shiftIdStrings.length
    ? await prisma.shift.findMany({
        where: { id: { in: shiftIdStrings } },
        select: { id: true, name: true, startTime: true, endTime: true, isActive: true },
      })
    : [];

  const shiftMap = new Map<string, { id: string; name: string; startTime: string | null; endTime: string | null; isActive: boolean }>(
    shifts.map((s) => [
      s.id,
      {
        id: s.id,
        name: s.name,
        startTime: s.startTime ?? null,
        endTime: s.endTime ?? null,
        isActive: Boolean(s.isActive),
      },
    ]),
  );

  return NextResponse.json(classes.map((cls) => mapClassRow(cls, countMap, teacherMap, shiftMap)));
}

// POST /api/classes
export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();

  if (!body.name) {
    return NextResponse.json(
      { message: "Class name is required" },
      { status: 400 }
    );
  }

  const teacherId = body.teacherId ?? null;
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
  const shiftResult = await validateShiftId(shiftId);
  if (shiftResult && "error" in shiftResult) return shiftResult.error;

  const scheduleDays = parseScheduleDays(body.scheduleDays);
  if (!scheduleDays) {
    return NextResponse.json({ message: "Select at least one class day" }, { status: 400 });
  }

  const inserted = await prisma.class.create({
    data: {
      name: body.name,
      level: body.level ?? null,
      teacherId,
      shiftId,
      scheduleDays,
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    },
  });

  return NextResponse.json(
    {
      id: inserted.id,
      name: body.name,
      level: body.level ?? null,
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      teacherId,
      teacher: null,
      shiftId,
      shift: shiftResult?.shift ?? null,
      scheduleDays,
      studentsCount: 0,
    },
    { status: 201 },
  );
}
