import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { formatInstituteDate, parseInstituteDay } from "@/lib/institute-date"

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get("classId")
  const range = parseInstituteDay(searchParams.get("date"))
  if (!range) return NextResponse.json({ message: "Invalid date" }, { status: 400 })

  const [records, classes] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        date: { gte: range.start, lt: range.end },
        student: { isHidden: false },
        ...(classId ? { classId } : {}),
      },
      select: { classId: true, status: true, teacherId: true },
    }),
    prisma.class.findMany({
      where: { isActive: true, ...(classId ? { id: classId } : {}) },
      select: {
        id: true,
        name: true,
        level: true,
        teacher: { select: { id: true, name: true, email: true } },
        students: { where: { isActive: true, isHidden: false }, select: { id: true } },
      },
      orderBy: { name: "asc" },
    }),
  ])

  const groupedMap = new Map<
    string,
    { presentCount: number; absentCount: number; total: number; teacherIds: Set<string> }
  >()

  for (const r of records) {
    const entry = groupedMap.get(r.classId) ?? {
      presentCount: 0,
      absentCount: 0,
      total: 0,
      teacherIds: new Set<string>(),
    }
    entry.total++
    if (r.status === "PRESENT") entry.presentCount++
    if (r.status === "ABSENT") entry.absentCount++
    if (r.teacherId) entry.teacherIds.add(r.teacherId)
    groupedMap.set(r.classId, entry)
  }

  const data = classes.map((cls) => {
    const g = groupedMap.get(cls.id) ?? {
      presentCount: 0,
      absentCount: 0,
      total: 0,
      teacherIds: new Set<string>(),
    }
    const markedTotal = g.total
    const total = cls.students.length
    const presentCount = g.presentCount
    const absentCount = g.absentCount
    const percentage = markedTotal ? Math.round((presentCount / markedTotal) * 100) : 0
    return {
      class: { id: cls.id, name: cls.name, level: cls.level },
      presentCount,
      absentCount,
      total,
      unmarkedCount: Math.max(0, total - markedTotal),
      percentage,
      teachers: cls.teacher ? [cls.teacher] : [],
    }
  })

  return NextResponse.json({
    date: formatInstituteDate(range.start),
    data,
  })
}
