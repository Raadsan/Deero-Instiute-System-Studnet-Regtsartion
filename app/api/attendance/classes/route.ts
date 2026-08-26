import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"

export async function GET() {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "TEACHER") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const classes = await prisma.class.findMany({
    where: { teacherId: session.userId, isActive: true },
    select: {
      id: true,
      name: true,
      level: true,
      isActive: true,
      scheduleDays: true,
      courses: {
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  })

  const classIds = classes.map((c) => c.id)
  const counts = classIds.length
    ? await prisma.student.groupBy({
        by: ["classId"],
        where: { classId: { in: classIds }, isActive: true, isHidden: false },
        _count: { _all: true },
      })
    : []

  const countMap = new Map<string, number>(
    counts.filter((r) => r.classId).map((r) => [r.classId!, r._count._all]),
  )

  return NextResponse.json(
    classes.map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level ?? null,
      isActive: Boolean(c.isActive),
      studentsCount: countMap.get(c.id) ?? 0,
      scheduleDays: c.scheduleDays ?? [],
      courses: c.courses,
    })),
  )
}
