import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"

function parseDateRange(dateParam: string | null) {
  const date = dateParam ? new Date(dateParam) : new Date()
  if (Number.isNaN(date.getTime())) return null
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  return { dayStart, dayEnd }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get("classId")
  if (!classId) return NextResponse.json({ message: "classId is required" }, { status: 400 })

  const range = parseDateRange(searchParams.get("date"))
  if (!range) return NextResponse.json({ message: "Invalid date" }, { status: 400 })

  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "200"), 1), 1000)

  const rows = await prisma.attendance.findMany({
    where: { classId, date: { gte: range.dayStart, lt: range.dayEnd } },
    select: { id: true, studentId: true, teacherId: true, status: true, note: true, date: true, createdAt: true },
    take: limit,
  })

  const studentIds = Array.from(new Set(rows.map((r) => r.studentId)))
  const teacherIds = Array.from(new Set(rows.map((r) => r.teacherId).filter((id): id is string => Boolean(id))))

  const [students, teachers, cls] = await Promise.all([
    studentIds.length
      ? prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true, 
            phone: true,
            gender: true,
            attendances: { select: { status: true } }
          },
        })
      : [],
    teacherIds.length
      ? prisma.user.findMany({
          where: { id: { in: teacherIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [],
    prisma.class.findUnique({ where: { id: classId }, select: { name: true, level: true } }),
  ])

  const studentMap = new Map(
    students.map((s) => {
      const total = s.attendances.length
      const presentCount = s.attendances.filter(a => a.status === "PRESENT").length
      const percentage = total > 0 ? Math.round((presentCount / total) * 100) : null
      
      return [
        s.id,
        {
          id: s.id,
          firstName: s.firstName ?? "",
          lastName: s.lastName ?? "",
          email: s.email ?? null,
          phone: s.phone ?? null,
          gender: s.gender ?? null,
          attendancePercentage: percentage
        },
      ]
    }),
  )
  const teacherMap = new Map(
    teachers
      .filter((t) => t.role === "TEACHER")
      .map((t) => [t.id, { id: t.id, name: t.name ?? "", email: t.email ?? "" }]),
  )

  const classInfo = cls
    ? { id: classId, name: cls.name ?? "", level: cls.level ?? null }
    : { id: classId, name: classId, level: null }

  const data = rows
    .map((r) => {
      const student = studentMap.get(r.studentId) ?? null
      const teacher = r.teacherId ? teacherMap.get(r.teacherId) ?? null : null
      return {
        id: r.id,
        class: classInfo,
        date: r.date.toISOString(),
        createdAt: r.createdAt?.toISOString() ?? null,
        status: r.status ?? "ABSENT",
        note: r.note ?? null,
        student,
        teacher,
      }
    })
    .sort((a, b) => {
      const an = `${a.student?.lastName ?? ""} ${a.student?.firstName ?? ""}`.toLowerCase()
      const bn = `${b.student?.lastName ?? ""} ${b.student?.firstName ?? ""}`.toLowerCase()
      return an.localeCompare(bn)
    })

  return NextResponse.json({
    date: range.dayStart.toISOString().slice(0, 10),
    class: classInfo,
    total: data.length,
    data,
  })
}
