import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { buildTeacherSearchFilter } from "@/lib/student-search";
import type { Prisma } from "@/lib/generated/prisma/client";

// GET /api/teachers (ADMIN, FINANCE read)
export async function GET(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN" && session.role !== "FINANCE") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const search = searchParams.get("search")?.trim() ?? "";
  const { page, pageSize, skip } = parsePagination(searchParams);

  const baseWhere: Prisma.UserWhereInput = {
    role: "TEACHER",
    ...(includeInactive ? {} : { isActive: true }),
  };
  const searchFilter = buildTeacherSearchFilter(search);
  const where: Prisma.UserWhereInput = searchFilter ? { AND: [baseWhere, searchFilter] } : baseWhere;

  const [total, teachers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, isActive: true },
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
    }),
  ]);

  const teacherIds = teachers.map((t) => t.id);
  const classRows = teacherIds.length
    ? await prisma.class.findMany({
        where: { teacherId: { in: teacherIds } },
        select: { id: true, name: true, level: true, teacherId: true },
      })
    : [];

  const classesByTeacher = new Map<string, Array<{ id: string; name: string; level: string | null }>>();
  for (const cls of classRows) {
    const tid = cls.teacherId;
    if (!tid) continue;
    const list = classesByTeacher.get(tid) ?? [];
    list.push({ id: cls.id, name: cls.name, level: cls.level ?? null });
    classesByTeacher.set(tid, list);
  }

  return NextResponse.json({
    items: teachers.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      isActive: Boolean(t.isActive),
      classes: classesByTeacher.get(t.id) ?? [],
    })),
    pagination: buildPaginationMeta(page, pageSize, total),
  });
}

// POST /api/teachers (ADMIN)
export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body: unknown = await req.json();
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 });

  const { name, email, password, classIds } = body as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    classIds?: unknown;
  };

  if (typeof name !== "string" || !name.trim()) return NextResponse.json({ message: "Name is required" }, { status: 400 });
  if (typeof email !== "string" || !email.trim()) return NextResponse.json({ message: "Email is required" }, { status: 400 });
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
  if (existing) return NextResponse.json({ message: "Email already in use" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const inserted = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: passwordHash,
      role: "TEACHER",
      isActive: true,
    },
  });

  const teacherId = inserted.id;
  const ids = Array.isArray(classIds) ? (classIds.filter((x) => typeof x === "string") as string[]) : [];
  if (ids.length) {
    await prisma.class.updateMany({ where: { id: { in: ids } }, data: { teacherId } });
  }

  return NextResponse.json({ id: teacherId, name: name.trim(), email: normalizedEmail, isActive: true, classes: [] }, { status: 201 });
}
