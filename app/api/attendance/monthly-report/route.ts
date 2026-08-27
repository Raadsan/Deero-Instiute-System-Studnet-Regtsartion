import { NextRequest, NextResponse } from "next/server"

import { getSessionFromRequestCookies } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatInstituteDate, parseInstituteDay, parseInstituteMonth } from "@/lib/institute-date"

function attendancePercentage(present: number, period: number) {
  if (period <= 0) return null
  const value = (present / period) * 100
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100))
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN" && session.role !== "TEACHER") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get("classId")
  const month = searchParams.get("month")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!classId) return NextResponse.json({ message: "Class is required" }, { status: 400 })

  let range: { start: Date; end: Date; from: string; to: string; label: string }
  if (from || to) {
    const fromDay = parseInstituteDay(from)
    const toDay = parseInstituteDay(to)
    if (!fromDay || !toDay) {
      return NextResponse.json({ message: "Select valid From and To dates" }, { status: 400 })
    }
    if (fromDay.start > toDay.start) {
      return NextResponse.json({ message: "From date cannot be after To date" }, { status: 400 })
    }
    const rangeDays = Math.ceil((toDay.end.getTime() - fromDay.start.getTime()) / (24 * 60 * 60 * 1000))
    if (rangeDays > 366) {
      return NextResponse.json({ message: "Date range cannot exceed 366 days" }, { status: 400 })
    }
    range = {
      start: fromDay.start,
      end: toDay.end,
      from: from!,
      to: to!,
      label: `${from} to ${to}`,
    }
  } else {
    const monthRange = parseInstituteMonth(month)
    if (!monthRange) return NextResponse.json({ message: "Select a valid month" }, { status: 400 })
    const rangeEndInclusive = new Date(monthRange.end.getTime() - 1)
    range = {
      ...monthRange,
      from: formatInstituteDate(monthRange.start),
      to: formatInstituteDate(rangeEndInclusive),
      label: new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "Africa/Nairobi",
      }).format(monthRange.start),
    }
  }

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      level: true,
      teacherId: true,
      teacher: { select: { name: true } },
      courses: { where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } },
      students: {
        where: { isActive: true, isHidden: false },
        select: { id: true, studentCode: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      },
    },
  })
  if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 })
  if (session.role === "TEACHER" && cls.teacherId !== session.userId) {
    return NextResponse.json({ message: "You are not assigned to this class" }, { status: 403 })
  }

  const records = await prisma.attendance.findMany({
    where: { classId, date: { gte: range.start, lt: range.end } },
    select: { studentId: true, status: true, date: true },
  })

  const attendancePeriods = new Set(records.map((record) => formatInstituteDate(record.date))).size

  const counts = new Map<string, { present: number; absent: number }>()
  for (const record of records) {
    const current = counts.get(record.studentId) ?? { present: 0, absent: 0 }
    if (record.status === "PRESENT") current.present++
    if (record.status === "ABSENT") current.absent++
    counts.set(record.studentId, current)
  }

  const students = cls.students.map((student) => {
    const count = counts.get(student.id) ?? { present: 0, absent: 0 }
    const period = count.present + count.absent
    return {
      id: student.studentCode ?? "UNASSIGNED",
      studentCode: student.studentCode ?? "STU",
      name: `${student.firstName} ${student.lastName}`.trim(),
      period,
      present: count.present,
      absent: count.absent,
      percentage: attendancePercentage(count.present, period),
    }
  })

  const totals = students.reduce(
    (sum, student) => ({
      period: sum.period + student.period,
      present: sum.present + student.present,
      absent: sum.absent + student.absent,
    }),
    { period: 0, present: 0, absent: 0 },
  )

  return NextResponse.json({
    month: month ?? null,
    range: { from: range.from, to: range.to, label: range.label },
    class: { id: cls.id, name: cls.name, level: cls.level },
    teacher: cls.teacher?.name ?? null,
    courses: cls.courses,
    students,
    totals: {
      ...totals,
      periods: attendancePeriods,
      percentage: attendancePercentage(totals.present, totals.period),
    },
  })
}
