import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageStudents, getSessionFromRequestCookies } from "@/lib/auth";
import { studentCodePrefix } from "@/lib/student-code";

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequestCookies();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!canManageStudents(session.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await req.json();
    if (!Array.isArray(body.students)) {
      return NextResponse.json({ message: "Invalid payload format. Expected 'students' array." }, { status: 400 });
    }

    const studentsData: unknown[] = body.students;

    if (studentsData.length === 0) {
      return NextResponse.json({ message: "No students provided." }, { status: 400 });
    }
    const normalizedStudents = studentsData.map((value) => {
      const student =
        typeof value === "object" && value !== null
          ? value as Record<string, unknown>
          : {}
      return {
        firstName: String(student.firstName ?? "").trim(),
        lastName: String(student.lastName ?? "").trim(),
        phone: student.phone ? String(student.phone).trim() : null,
        email: student.email ? String(student.email).trim() : null,
        gender: student.gender ? String(student.gender).trim() : null,
        classId: typeof student.classId === "string" && student.classId ? student.classId : null,
        paymentStatus: student.paymentStatus === "PAID" ? "PAID" as const : "UNPAID" as const,
        enrollmentStatus: "ENROLLED" as const,
      }
    })
    if (normalizedStudents.some((student) => !student.firstName || !student.lastName)) {
      return NextResponse.json({ message: "Every row must contain a student name." }, { status: 400 });
    }
    if (normalizedStudents.some((student) => !student.classId)) {
      return NextResponse.json({ message: "Select a class before importing students." }, { status: 400 });
    }

    const classIds = Array.from(
      new Set(normalizedStudents.map((student) => student.classId).filter((id): id is string => Boolean(id))),
    )
    const classes = classIds.length
      ? await prisma.class.findMany({
          where: { id: { in: classIds }, isActive: true },
          select: { id: true, name: true },
        })
      : []
    if (classes.length !== classIds.length) {
      return NextResponse.json({ message: "One or more selected classes are invalid." }, { status: 400 });
    }
    const classNameById = new Map(classes.map((item) => [item.id, item.name]))

    const prefixes = Array.from(
      new Set(
        normalizedStudents.map((student) =>
          studentCodePrefix(student.classId ? classNameById.get(student.classId) : null),
        ),
      ),
    )
    const existingCodes = await prisma.student.findMany({
      where: { OR: prefixes.map((prefix) => ({ studentCode: { startsWith: `${prefix}-` } })) },
      select: { studentCode: true },
    })
    const highestByPrefix = new Map(prefixes.map((prefix) => [prefix, 0]))
    for (const student of existingCodes) {
      const [prefix, sequence] = student.studentCode?.split("-") ?? []
      if (!prefix) continue
      highestByPrefix.set(prefix, Math.max(highestByPrefix.get(prefix) ?? 0, Number(sequence) || 0))
    }

    const data = normalizedStudents.map((student) => {
      const prefix = studentCodePrefix(student.classId ? classNameById.get(student.classId) : null)
      const sequence = (highestByPrefix.get(prefix) ?? 0) + 1
      highestByPrefix.set(prefix, sequence)
      return {
        ...student,
        studentCode: `${prefix}-${String(sequence).padStart(3, "0")}`,
        isActive: true,
        registeredById: session.userId,
      }
    })
    const inserted = await prisma.student.createMany({ data });

    return NextResponse.json({ count: inserted.count }, { status: 201 });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json({ message: "Failed to upload students. Please check your data format." }, { status: 500 });
  }
}
