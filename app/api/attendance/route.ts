import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { getWeekdayFromDateInput } from "@/lib/class-schedule"
import { parseInstituteDay } from "@/lib/institute-date"
import { enqueueAndSendWhatsAppMessage, hasRecentAbsenceAlert } from "@/lib/whatsapp-queue"
import { enqueueAndSendEmailMessage, hasRecentAbsenceEmailAlert } from "@/lib/email-queue"
import { buildBroadcastEmailTemplate } from "@/lib/email-templates"
import { getBrandName } from "@/lib/brand"

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
      (candidate.status !== "PRESENT" && candidate.status !== "ABSENT") ||
      (candidate.note !== undefined && typeof candidate.note !== "string") ||
      (typeof candidate.note === "string" && candidate.note.trim().length > 500)
    )
  })
  if (hasInvalidItem) {
    return NextResponse.json({ message: "Invalid attendance item or excuse (maximum 500 characters)" }, { status: 400 })
  }

  const items = rawItems.map((item) => {
    const candidate = item as { studentId: string; status: "PRESENT" | "ABSENT"; note?: string }
    const note = candidate.status === "ABSENT" ? candidate.note?.trim() || undefined : undefined
    return { studentId: candidate.studentId, status: candidate.status, note }
  })

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { teacherId: true, isActive: true, scheduleDays: true },
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
    select: { id: true, studentCode: true },
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

  const channel = (process.env.NOTIFICATIONS_CHANNEL ?? "email").toLowerCase()

  const absentStudentIds = Array.from(new Set(resolvedItems.filter((x) => x.status === "ABSENT").map((x) => x.studentId)))
  if (absentStudentIds.length) {
    const windowDays = 30
    const threshold = 3
    const since = new Date(dayStart)
    since.setDate(since.getDate() - windowDays)

    const phones = await prisma.student.findMany({
      where: { id: { in: absentStudentIds } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, classId: true },
    })

    const phoneMap = new Map<string, { name: string; phone: string | null }>(
      phones.map((s) => [
        s.id,
        { name: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "Student", phone: s.phone ?? null },
      ]),
    )

    const emailMap = new Map<string, { name: string; email: string | null }>(
      phones.map((s) => [
        s.id,
        { name: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "Student", email: s.email ?? null },
      ]),
    )

    await Promise.all(
      absentStudentIds.map(async (studentId) => {
        const count = await prisma.attendance.count({
          where: {
            studentId,
            classId,
            status: "ABSENT",
            date: { gte: since, lte: dayStart },
          },
        })

        if (count < threshold) return

        const msg = `Attendance Alert: ${emailMap.get(studentId)?.name ?? "Student"} has been absent ${threshold} times in the last ${windowDays} days. Please ensure attendance improves.`

        if (channel === "whatsapp" || channel === "both") {
          const already = await hasRecentAbsenceAlert({ studentId, classId, absentCount: threshold, withinDays: windowDays })
          if (!already) {
            const info = phoneMap.get(studentId) ?? { name: "Student", phone: null }
            await enqueueAndSendWhatsAppMessage({
              to: info.phone,
              body: msg,
              meta: { kind: "ABSENCE_ALERT", studentId, classId, absentCount: threshold, windowDays },
            })
          }
        }

        if (channel === "email" || channel === "both") {
          const already = await hasRecentAbsenceEmailAlert({ studentId, classId, absentCount: threshold, withinDays: windowDays })
          if (already) return
          const info = emailMap.get(studentId) ?? { name: "Student", email: null }
          const template = buildBroadcastEmailTemplate({
            subject: "Attendance Alert",
            message: msg,
            contextTitle: "Attendance Alert",
            contextSubtitle: `Class: ${classId}`,
            logoCid: "brandlogo",
            brandName: getBrandName(),
          })
          await enqueueAndSendEmailMessage({
            to: info.email,
            subject: "Attendance Alert",
            text: template.text,
            html: template.html,
            meta: { kind: "ABSENCE_ALERT", studentId, classId, absentCount: threshold, windowDays },
          })
        }
      }),
    )
  }

  return NextResponse.json({ ok: true, count: created.count })
}
