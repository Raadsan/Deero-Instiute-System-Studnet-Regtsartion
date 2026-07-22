import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"

type ActivityRow = {
  id: string
  type: "enrollment" | "attendance" | "payment" | "teacher" | "class" | "course"
  message: string
  timestamp: string
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get("limit") ?? 10) || 10, 25)
  const perTypeLimit = Math.min(Math.max(limit, 6), 12)

  const [students, payments, recentAttendanceRows, teachers, recentClasses, courses] = await Promise.all([
    prisma.student.findMany({
      select: { id: true, firstName: true, lastName: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: perTypeLimit,
    }),
    prisma.payment.findMany({
      select: { id: true, studentId: true, amount: true, currency: true, paidAt: true, createdAt: true },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: perTypeLimit,
    }),
    prisma.attendance.findMany({
      select: { classId: true, date: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { role: "TEACHER" },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: perTypeLimit,
    }),
    prisma.class.findMany({
      select: { id: true, name: true, level: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: perTypeLimit,
    }),
    prisma.course.findMany({
      select: { id: true, name: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: perTypeLimit,
    }),
  ])

  const seenAttendance = new Set<string>()
  const attendances: Array<{ classId: string; date: Date; createdAt: Date }> = []
  for (const row of recentAttendanceRows) {
    const key = `${row.classId}-${row.date.toISOString().slice(0, 10)}`
    if (seenAttendance.has(key)) continue
    seenAttendance.add(key)
    attendances.push(row)
    if (attendances.length >= perTypeLimit) break
  }

  const studentActivities: ActivityRow[] = students.map((s) => {
    const name = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "Student"
    const timestamp = normalizeDate(s.createdAt ?? s.updatedAt)
    return {
      id: `student-${s.id}`,
      type: "enrollment",
      message: `New student enrollment: ${name}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const paymentStudentIds = Array.from(new Set(payments.map((p) => p.studentId).filter(Boolean)))
  const paymentStudents = paymentStudentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: paymentStudentIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : []
  const paymentStudentMap = new Map<string, string>(
    paymentStudents.map((s) => [s.id, `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "Student"]),
  )

  const paymentActivities: ActivityRow[] = payments.map((p) => {
    const studentName = paymentStudentMap.get(p.studentId) ?? "Student"
    const amount = Number(p.amount ?? 0)
    const currency = p.currency ?? "USD"
    const amountLabel = amount > 0 ? `${amount.toLocaleString()} ${currency}` : null
    const timestamp = normalizeDate(p.paidAt ?? p.createdAt)
    return {
      id: `payment-${p.id}`,
      type: "payment",
      message: amountLabel ? `Payment received: ${amountLabel} from ${studentName}` : `Payment received from ${studentName}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const classIds = Array.from(new Set(attendances.map((a) => a.classId).filter(Boolean)))
  const classLookupRows = classIds.length
    ? await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
    : []
  const classMap = new Map<string, string>(classLookupRows.map((c) => [c.id, c.name ?? "Class"]))

  const attendanceActivities: ActivityRow[] = attendances.map((a) => {
    const className = classMap.get(a.classId) ?? "Class"
    const timestamp = normalizeDate(a.createdAt ?? a.date)
    const idSuffix = `${a.classId}-${timestamp.toISOString()}`
    return {
      id: `attendance-${idSuffix}`,
      type: "attendance",
      message: `Attendance marked for ${className}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const teacherActivities: ActivityRow[] = teachers.map((t) => {
    const name = t.name ?? "Teacher"
    const timestamp = normalizeDate(t.createdAt ?? t.updatedAt)
    return {
      id: `teacher-${t.id}`,
      type: "teacher",
      message: `New teacher added: ${name}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const classActivities: ActivityRow[] = recentClasses.map((c) => {
    const name = c.name ?? "Class"
    const level = c.level ?? null
    const label = level ? `${name} (${level})` : name
    const timestamp = normalizeDate(c.createdAt ?? c.updatedAt)
    return {
      id: `class-${c.id}`,
      type: "class",
      message: `New class created: ${label}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const courseActivities: ActivityRow[] = courses.map((c) => {
    const name = c.name ?? "Course"
    const timestamp = normalizeDate(c.createdAt ?? c.updatedAt)
    return {
      id: `course-${c.id}`,
      type: "course",
      message: `New course created: ${name}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const allActivities = [
    ...studentActivities,
    ...paymentActivities,
    ...attendanceActivities,
    ...teacherActivities,
    ...classActivities,
    ...courseActivities,
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const seen = new Set<string>()
  const activities: ActivityRow[] = []
  for (const item of allActivities) {
    const key = `${item.type}:${item.message}`
    if (seen.has(key)) continue
    seen.add(key)
    activities.push(item)
    if (activities.length >= limit) break
  }

  return NextResponse.json({ items: activities })
}
