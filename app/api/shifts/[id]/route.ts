import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequestCookies } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
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
  const isActive = typeof body.isActive === "boolean" ? body.isActive : Boolean(body.isActive);

  const existing = await prisma.shift.findFirst({ where: { name }, select: { id: true } });
  if (existing && existing.id !== id) {
    return NextResponse.json({ message: "A shift with this name already exists" }, { status: 409 });
  }

  try {
    const updated = await prisma.shift.update({
      where: { id },
      data: { name, startTime, endTime, isActive },
    });
    return NextResponse.json(serializeShift(updated));
  } catch {
    return NextResponse.json({ message: "Shift not found" }, { status: 404 });
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const inUse = await prisma.class.findFirst({ where: { shiftId: id }, select: { id: true } });
  if (inUse) {
    return NextResponse.json(
      { message: "Cannot delete shift while classes are assigned to it" },
      { status: 409 },
    );
  }

  try {
    await prisma.shift.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Shift not found" }, { status: 404 });
  }
}
