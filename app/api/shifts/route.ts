import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequestCookies } from "@/lib/auth";

function serializeShift(doc: {
  id: string;
  name: string;
  startTime?: string | null;
  endTime?: string | null;
  isActive?: boolean;
}) {
  return {
    id: doc.id,
    name: doc.name,
    startTime: doc.startTime ?? null,
    endTime: doc.endTime ?? null,
    isActive: Boolean(doc.isActive),
  };
}

// GET /api/shifts
export async function GET(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const shifts = await prisma.shift.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(shifts.map(serializeShift));
}

// POST /api/shifts
export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ message: "Shift name is required" }, { status: 400 });
  }

  const startTime = typeof body.startTime === "string" && body.startTime.trim() ? body.startTime.trim() : null;
  const endTime = typeof body.endTime === "string" && body.endTime.trim() ? body.endTime.trim() : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  const existing = await prisma.shift.findFirst({ where: { name }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ message: "A shift with this name already exists" }, { status: 409 });
  }

  const inserted = await prisma.shift.create({
    data: { name, startTime, endTime, isActive },
  });

  return NextResponse.json(serializeShift(inserted), { status: 201 });
}
