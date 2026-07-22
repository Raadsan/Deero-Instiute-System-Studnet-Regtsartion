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
  const range = parseDateRange(searchParams.get("date"))
  if (!range) return NextResponse.json({ message: "Invalid date" }, { status: 400 })

  const records = await prisma.attendance.findMany({
    where: {
      date: { gte: range.dayStart, lt: range.dayEnd },
      ...(classId ? { classId } : {}),
    },
    select: { classId: true, status: true, teacherId: true },
  })

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

  const classIds = Array.from(groupedMap.keys()).sort()
  const teacherIdSet = new Set<string>()
  for (const entry of groupedMap.values()) {
    for (const tid of entry.teacherIds) teacherIdSet.add(tid)
  }

  const [classes, teachers] = await Promise.all([
    classIds.length
      ? prisma.class.findMany({
          where: { id: { in: classIds } },
          select: { id: true, name: true, level: true },
        })
      : [],
    teacherIdSet.size
      ? prisma.user.findMany({
          where: { id: { in: Array.from(teacherIdSet) } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [],
  ])

  const classMap = new Map(
    classes.map((c) => [c.id, { id: c.id, name: c.name ?? "", level: c.level ?? null }]),
  )
  const teacherMap = new Map(
    teachers.filter((t) => t.role === "TEACHER").map((t) => [t.id, { id: t.id, name: t.name ?? "", email: t.email ?? "" }]),
  )

  const data = classIds.map((id) => {
    const g = groupedMap.get(id)!
    const total = g.total
    const presentCount = g.presentCount
    const absentCount = g.absentCount
    const percentage = total ? Math.round((presentCount / total) * 100) : 0
    const classInfo = classMap.get(id) ?? { id, name: id, level: null }
    const teacherList = Array.from(g.teacherIds)
      .map((tid) => teacherMap.get(tid))
      .filter((x): x is { id: string; name: string; email: string } => Boolean(x))
    return {
      class: classInfo,
      presentCount,
      absentCount,
      total,
      percentage,
      teachers: teacherList,
    }
  })

  return NextResponse.json({
    date: range.dayStart.toISOString().slice(0, 10),
    data,
  })
}
