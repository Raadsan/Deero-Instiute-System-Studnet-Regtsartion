import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageStudents, getSessionFromRequestCookies } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequestCookies();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!canManageStudents(session.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await req.json();
    if (!Array.isArray(body.students)) {
      return NextResponse.json({ message: "Invalid payload format. Expected 'students' array." }, { status: 400 });
    }

    const studentsData = body.students;

    if (studentsData.length === 0) {
      return NextResponse.json({ message: "No students provided." }, { status: 400 });
    }

    const inserted = await prisma.student.createMany({
      data: studentsData.map((s: any) => ({
        firstName: s.firstName,
        lastName: s.lastName,
        phone: s.phone ?? null,
        email: s.email ?? null,
        gender: s.gender ?? null,
        classId: s.classId ?? null,
        paymentStatus: s.paymentStatus ?? "UNPAID",
        enrollmentStatus: s.enrollmentStatus ?? "ENROLLED",
        isActive: true,
        registeredById: session.userId,
      })),
    });

    return NextResponse.json({ count: inserted.count }, { status: 201 });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json({ message: "Failed to upload students. Please check your data format." }, { status: 500 });
  }
}
