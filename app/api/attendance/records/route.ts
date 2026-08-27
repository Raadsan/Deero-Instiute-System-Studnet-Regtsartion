import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { calculateAttendancePercentage } from "@/lib/attendance-status"
import { formatInstituteDate, parseInstituteDay } from "@/lib/institute-date"

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get("classId")

  const range = parseInstituteDay(searchParams.get("date"))
  if (!range) return NextResponse.json({ message: "Invalid date" }, { status: 400 })

  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "200"), 1), 1000)

  const attendanceScope = classId ? { classId } : {}
  const [rows, latestRecord] = await Promise.all([
    prisma.attendance.findMany({
      where: { ...attendanceScope, date: { gte: range.start, lt: range.end } },
      select: { id: true, studentId: true, classId: true, teacherId: true, status: true, note: true, date: true, createdAt: true },
      take: limit,
    }),
    prisma.attendance.findFirst({
      where: attendanceScope,
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ])

  const teacherIds = Array.from(new Set(rows.map((r) => r.teacherId).filter((id): id is string => Boolean(id))))

  const [students, teachers, classes] = await Promise.all([
    prisma.student.findMany({
          where: { isActive: true, isHidden: false, ...(classId ? { classId } : { classId: { not: null } }) },
          select: { 
            id: true, 
            classId: true,
            studentCode: true,
            firstName: true, 
            lastName: true, 
            email: true, 
            phone: true,
            gender: true,
            attendances: { select: { status: true } }
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        }),
    teacherIds.length
      ? prisma.user.findMany({
          where: { id: { in: teacherIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [],
    prisma.class.findMany({
      where: classId ? { id: classId } : { isActive: true },
      select: { id: true, name: true, level: true },
    }),
  ])

  const studentMap = new Map(
    students.map((s) => {
      const presentCount = s.attendances.filter(a => a.status === "PRESENT").length
      const lateCount = s.attendances.filter(a => a.status === "LATE").length
      const absentCount = s.attendances.filter(a => a.status === "ABSENT").length
      const percentage = calculateAttendancePercentage(presentCount, lateCount, absentCount)
      
      return [
        s.id,
        {
          id: s.id,
          studentCode: s.studentCode ?? "UNASSIGNED",
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

  const classMap = new Map(classes.map((cls) => [
    cls.id,
    { id: cls.id, name: cls.name ?? "", level: cls.level ?? null },
  ]))
  const selectedClass = classId ? classMap.get(classId) ?? { id: classId, name: classId, level: null } : null

  const recordByStudentId = new Map(rows.map((row) => [row.studentId, row]))
  const data = students
    .filter((student) => student.classId && classMap.has(student.classId))
    .map((studentRow) => {
      const r = recordByStudentId.get(studentRow.id)
      const student = studentMap.get(studentRow.id) ?? null
      const teacher = r?.teacherId ? teacherMap.get(r.teacherId) ?? null : null
      const rowClassId = studentRow.classId!
      return {
        id: r?.id ?? `unmarked-${studentRow.id}`,
        class: classMap.get(rowClassId) ?? { id: rowClassId, name: rowClassId, level: null },
        date: r?.date.toISOString() ?? null,
        createdAt: r?.createdAt?.toISOString() ?? null,
        status: r?.status ?? "NOT_MARKED",
        note: r?.note ?? null,
        student,
        teacher,
      }
    })
    .sort((a, b) => {
      const an = `${a.student?.lastName ?? ""} ${a.student?.firstName ?? ""}`.toLowerCase()
      const bn = `${b.student?.lastName ?? ""} ${b.student?.firstName ?? ""}`.toLowerCase()
      const classCompare = a.class.name.localeCompare(b.class.name)
      return classCompare || an.localeCompare(bn)
    })

  return NextResponse.json({
    date: formatInstituteDate(range.start),
    class: selectedClass,
    latestDate: latestRecord ? formatInstituteDate(latestRecord.date) : null,
    total: rows.length,
    rosterTotal: data.length,
    data,
  })
}
