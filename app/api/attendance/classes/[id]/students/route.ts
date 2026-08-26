import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { getWeekdayFromDateInput } from "@/lib/class-schedule"
import { parseInstituteDay } from "@/lib/institute-date"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id: classId } = await params
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "TEACHER") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { teacherId: true, isActive: true, scheduleDays: true, name: true },
  })
  if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 })
  if (!cls.isActive) return NextResponse.json({ message: "Class is inactive" }, { status: 400 })
  if (cls.teacherId !== session.userId) {
    return NextResponse.json({ message: "You are not assigned to this class" }, { status: 403 })
  }

  const scheduleDays = cls.scheduleDays ?? []
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get("date")

  let isScheduledDay = false
  let attendanceRecords: Array<{ studentId: string; status: "PRESENT" | "ABSENT"; note: string | null }> = []

  if (dateStr) {
    const range = parseInstituteDay(dateStr)
    const weekday = getWeekdayFromDateInput(dateStr)
    if (range && weekday !== null) {
      isScheduledDay = scheduleDays.includes(weekday)

      if (isScheduledDay) {
        const records = await prisma.attendance.findMany({
          where: { classId, teacherId: session.userId, date: { gte: range.start, lt: range.end } },
          select: { studentId: true, status: true, note: true },
        })

        attendanceRecords = records
      }
    }
  }

  if (!isScheduledDay) {
    return NextResponse.json({
      className: cls.name,
      scheduleDays,
      isScheduledDay: false,
      students: [],
      attendance: {},
      notes: {},
    })
  }

  const students = await prisma.student.findMany({
    where: { classId, isActive: true, isHidden: false },
    select: { 
      id: true, 
      studentCode: true,
      firstName: true, 
      lastName: true,
      attendances: {
        select: { status: true }
      }
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  })
  const publicCodeByInternalId = new Map(
    students.map((student) => [student.id, student.studentCode ?? "UNASSIGNED"]),
  )
  const attendanceMap = Object.fromEntries(
    attendanceRecords.map((record) => [
      publicCodeByInternalId.get(record.studentId) ?? "UNASSIGNED",
      record.status,
    ]),
  )
  const noteMap = Object.fromEntries(
    attendanceRecords
      .filter((record) => record.note)
      .map((record) => [
        publicCodeByInternalId.get(record.studentId) ?? "UNASSIGNED",
        record.note ?? "",
      ]),
  )

  return NextResponse.json({
    className: cls.name,
    scheduleDays,
    isScheduledDay: true,
    students: students.map((s) => {
      const total = s.attendances.length
      const presentCount = s.attendances.filter(a => a.status === "PRESENT").length
      const percentage = total > 0 ? Math.round((presentCount / total) * 100) : null
      
      return { 
        id: s.studentCode ?? "UNASSIGNED",
        studentCode: s.studentCode ?? "UNASSIGNED",
        firstName: s.firstName, 
        lastName: s.lastName,
        attendancePercentage: percentage
      }
    }),
    attendance: attendanceMap,
    notes: noteMap,
  })
}
