import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequestCookies, registrarRoleFilter } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const registrars = await prisma.user.findMany({
    where: {
      ...registrarRoleFilter(),
      ...(includeInactive ? {} : { isActive: true }),
    },
    select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  const registrarIds = registrars.map((r) => r.id);
  const counts = registrarIds.length
    ? await prisma.student.groupBy({
        by: ["registeredById"],
        where: { registeredById: { in: registrarIds } },
        _count: { _all: true },
      })
    : [];

  const countMap = new Map<string, number>(
    counts
      .filter((r) => r.registeredById)
      .map((r) => [r.registeredById!, r._count._all]),
  );

  return NextResponse.json(
    registrars.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      isActive: Boolean(r.isActive),
      studentsRegistered: countMap.get(r.id) ?? 0,
      createdAt: r.createdAt ?? null,
    })),
  );
}

export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body: unknown = await req.json();
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 });

  const { name, email, password } = body as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
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
      role: "REGISTRAR",
      isActive: true,
    },
  });

  return NextResponse.json(
    {
      id: inserted.id,
      name: name.trim(),
      email: normalizedEmail,
      isActive: true,
      studentsRegistered: 0,
    },
    { status: 201 },
  );
}
