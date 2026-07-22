import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { isClassScheduledOnDate } from "@/lib/class-schedule"

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
  let attendanceMap: Record<string, "PRESENT" | "ABSENT"> = {}

  if (dateStr) {
    const date = new Date(dateStr)
    if (!Number.isNaN(date.getTime())) {
      isScheduledDay = isClassScheduledOnDate(scheduleDays, date)

      if (isScheduledDay) {
        const dayStart = new Date(date)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(dayStart)
        dayEnd.setDate(dayEnd.getDate() + 1)

        const records = await prisma.attendance.findMany({
          where: { classId, teacherId: session.userId, date: { gte: dayStart, lt: dayEnd } },
          select: { studentId: true, status: true },
        })

        attendanceMap = Object.fromEntries(records.map((r) => [r.studentId, r.status as "PRESENT" | "ABSENT"]))
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
    })
  }

  const students = await prisma.student.findMany({
    where: { classId, isActive: true },
    select: { 
      id: true, 
      firstName: true, 
      lastName: true,
      gender: true,
      attendances: {
        select: { status: true }
      }
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  })

  return NextResponse.json({
    className: cls.name,
    scheduleDays,
    isScheduledDay: true,
    students: students.map((s) => {
      const total = s.attendances.length
      const presentCount = s.attendances.filter(a => a.status === "PRESENT").length
      const percentage = total > 0 ? Math.round((presentCount / total) * 100) : null
      
      return { 
        id: s.id, 
        firstName: s.firstName, 
        lastName: s.lastName,
        gender: s.gender,
        attendancePercentage: percentage
      }
    }),
    attendance: attendanceMap,
  })
}
