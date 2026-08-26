import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get("classId")
  if (!classId) return NextResponse.json({ message: "classId is required" }, { status: 400 })

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true, teacherId: true, isActive: true },
  })
  if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 })

  if (session.role === "TEACHER") {
    if (cls.teacherId !== session.userId) {
      return NextResponse.json({ message: "You are not assigned to this class" }, { status: 403 })
    }
  } else if (session.role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - 30)
  start.setHours(0, 0, 0, 0)

  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  const students = await prisma.student.findMany({
    where: { classId, isActive: true, isHidden: false },
    select: { id: true, studentCode: true, firstName: true, lastName: true },
  })
  const publicCodeByInternalId = new Map(
    students.map((student) => [student.id, student.studentCode ?? "UNASSIGNED"]),
  )

  const records = await prisma.attendance.findMany({
    where: { classId, date: { gte: start, lte: end } },
    select: { studentId: true, date: true, status: true },
  })

  const historyMap: Record<string, Record<string, string>> = {}

  records.forEach((r) => {
    const sId = publicCodeByInternalId.get(r.studentId)
    if (!sId) return
    const dStr = r.date.toISOString().split("T")[0]
    if (!historyMap[sId]) historyMap[sId] = {}
    historyMap[sId][dStr] = r.status
  })

  return NextResponse.json({
    class: { id: classId, name: cls.name },
    students: students.map((s) => ({
      id: s.studentCode ?? "UNASSIGNED",
      name: `${s.firstName} ${s.lastName}`.trim(),
    })),
    history: historyMap,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  })
}
