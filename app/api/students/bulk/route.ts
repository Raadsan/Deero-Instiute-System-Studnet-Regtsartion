import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageStudents, getSessionFromRequestCookies } from "@/lib/auth";
import { nextStudentCode } from "@/lib/student-code";

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
    if (studentsData.length > 250) {
      return NextResponse.json({ message: "A maximum of 250 students can be uploaded at once." }, { status: 400 });
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

    const insertedCount = await prisma.$transaction(
      async (tx) => {
        let count = 0
        for (const student of normalizedStudents) {
          const className = student.classId ? classNameById.get(student.classId) : null
          const studentCode = await nextStudentCode(tx, className)
          await tx.student.create({
            data: {
              ...student,
              studentCode,
              isActive: true,
              registeredById: session.userId,
            },
          })
          count++
        }
        return count
      },
      { timeout: 30_000 },
    );

    return NextResponse.json({ count: insertedCount }, { status: 201 });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json({ message: "Failed to upload students. Please check your data format." }, { status: 500 });
  }
}
