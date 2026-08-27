import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { getWeekdayFromDateInput } from "@/lib/class-schedule"
import { formatInstituteDate, parseInstituteDay } from "@/lib/institute-date"
import { isAttendanceStatus, type AttendanceStatus } from "@/lib/attendance-status"
import {
  buildConsecutiveAbsenceSms,
  CONSECUTIVE_ABSENCE_THRESHOLD,
  isNewConsecutiveAbsenceStreak,
} from "@/lib/attendance-notifications"
import { enqueueAndSendSms, hasAbsenceSmsAlert } from "@/lib/sms-queue"

export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "TEACHER") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body = await req.json()

  const dateValue = typeof body.date === "string" ? body.date : null
  const range = parseInstituteDay(dateValue)
  if (!range) return NextResponse.json({ message: "Invalid date" }, { status: 400 })

  const classId = body.classId as string
  if (!classId) return NextResponse.json({ message: "classId is required" }, { status: 400 })

  const teacherId = session.userId

  const rawItems = body.items as unknown
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ message: "items is required" }, { status: 400 })
  }

  const hasInvalidItem = rawItems.some((item) => {
    if (!item || typeof item !== "object") return true
    const candidate = item as Record<string, unknown>
    return (
      typeof candidate.studentId !== "string" ||
      !isAttendanceStatus(candidate.status) ||
      (candidate.note !== undefined && typeof candidate.note !== "string") ||
      (typeof candidate.note === "string" && candidate.note.trim().length > 500)
    )
  })
  if (hasInvalidItem) {
    return NextResponse.json({ message: "Invalid attendance item or excuse (maximum 500 characters)" }, { status: 400 })
  }

  const items = rawItems.map((item) => {
    const candidate = item as { studentId: string; status: AttendanceStatus; note?: string }
    const note = candidate.status !== "PRESENT" ? candidate.note?.trim() || undefined : undefined
    return { studentId: candidate.studentId, status: candidate.status, note }
  })

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { teacherId: true, isActive: true, scheduleDays: true, name: true },
  })
  if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 })
  if (!cls.isActive) return NextResponse.json({ message: "Class is inactive" }, { status: 400 })
  if (cls.teacherId !== teacherId) {
    return NextResponse.json({ message: "You are not assigned to this class" }, { status: 403 })
  }

  const weekday = dateValue ? getWeekdayFromDateInput(dateValue) : null
  if (weekday === null || !(cls.scheduleDays ?? []).includes(weekday)) {
    return NextResponse.json(
      { message: "Attendance can only be recorded on scheduled class days" },
      { status: 400 },
    )
  }

  const studentCodes = items.map((it) => it.studentId)
  const uniqueStudentCodes = Array.from(new Set(studentCodes))

  const students = await prisma.student.findMany({
    where: { studentCode: { in: uniqueStudentCodes }, classId, isActive: true, isHidden: false },
    select: { id: true, studentCode: true, firstName: true, phone: true },
  })

  if (students.length !== uniqueStudentCodes.length) {
    return NextResponse.json({ message: "Some students do not belong to this class" }, { status: 400 })
  }
  const internalIdByStudentCode = new Map(
    students.map((student) => [student.studentCode, student.id]),
  )
  const resolvedItems = items.map((item) => ({
    ...item,
    studentId: internalIdByStudentCode.get(item.studentId)!,
  }))
  const uniqueStudentIds = students.map((student) => student.id)

  const dayStart = range.start
  const dayEnd = range.end

  await prisma.attendance.deleteMany({
    where: {
      classId,
      studentId: { in: uniqueStudentIds },
      date: { gte: dayStart, lt: dayEnd },
    },
  })

  const docs = resolvedItems.map((it) => ({
    date: dayStart,
    classId,
    teacherId,
    studentId: it.studentId,
    status: it.status,
    note: it.note ?? null,
  }))

  const created = await prisma.attendance.createMany({ data: docs })

  const absentStudentIds = Array.from(new Set(resolvedItems.filter((x) => x.status === "ABSENT").map((x) => x.studentId)))
  const smsResults: Array<{ studentId: string; status: "SENT" | "SKIPPED" | "FAILED" }> = []
  if (absentStudentIds.length) {
    const recentSessions = await prisma.attendance.findMany({
      where: { classId, date: { lt: dayEnd } },
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "desc" },
      take: CONSECUTIVE_ABSENCE_THRESHOLD + 1,
    })
    const sessionDates = recentSessions.map((session) => session.date)
    if (sessionDates.length >= CONSECUTIVE_ABSENCE_THRESHOLD) {
      const recentAttendance = await prisma.attendance.findMany({
        where: { classId, studentId: { in: absentStudentIds }, date: { in: sessionDates } },
        select: { studentId: true, date: true, status: true },
      })
      const statusByStudentAndDate = new Map(
        recentAttendance.map((record) => [`${record.studentId}:${record.date.getTime()}`, record.status]),
      )
      const studentById = new Map(students.map((student) => [student.id, student]))

      await Promise.all(absentStudentIds.map(async (studentId) => {
        try {
          const statuses = sessionDates.map(
            (sessionDate) => statusByStudentAndDate.get(`${studentId}:${sessionDate.getTime()}`) ?? "NOT_MARKED",
          )
          if (!isNewConsecutiveAbsenceStreak(statuses)) return

          const streakStartDate = formatInstituteDate(sessionDates[CONSECUTIVE_ABSENCE_THRESHOLD - 1])
          const streakEndDate = formatInstituteDate(sessionDates[0])
          if (await hasAbsenceSmsAlert({ studentId, classId, streakEndDate })) return

          const student = studentById.get(studentId)
          const result = await enqueueAndSendSms({
            to: student?.phone ?? null,
            body: buildConsecutiveAbsenceSms({
              firstName: student?.firstName ?? "Arday",
              className: cls.name,
            }),
            meta: {
              kind: "ABSENCE_ALERT",
              studentId,
              classId,
              consecutiveAbsences: CONSECUTIVE_ABSENCE_THRESHOLD,
              streakStartDate,
              streakEndDate,
            },
          })
          smsResults.push({ studentId, status: result.status })
        } catch (error) {
          console.error(`Automatic absence SMS failed for student ${studentId}:`, error)
          smsResults.push({ studentId, status: "FAILED" })
        }
      }))
    }
  }

  return NextResponse.json({
    ok: true,
    count: created.count,
    sms: {
      sent: smsResults.filter((result) => result.status === "SENT").length,
      skipped: smsResults.filter((result) => result.status === "SKIPPED").length,
      failed: smsResults.filter((result) => result.status === "FAILED").length,
    },
  })
}
