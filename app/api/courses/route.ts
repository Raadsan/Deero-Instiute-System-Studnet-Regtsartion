import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import type { Prisma } from "@/lib/generated/prisma/client"

type CourseStatus = "ACTIVE" | "SCHEDULED" | "INACTIVE"

function isCourseStatus(value: unknown): value is CourseStatus {
  return value === "ACTIVE" || value === "SCHEDULED" || value === "INACTIVE"
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get("classId")
  const teacherId = searchParams.get("teacherId")
  const status = searchParams.get("status")

  const where: Prisma.CourseWhereInput = {}
  if (classId) where.classId = classId
  if (teacherId) where.teacherId = teacherId
  if (status) where.status = status as CourseStatus

  const courses = await prisma.course.findMany({ where, orderBy: { createdAt: "desc" } })

  const classIds = Array.from(new Set(courses.map((c) => c.classId).filter(Boolean)))
  const teacherIds = Array.from(
    new Set(courses.map((c) => c.teacherId).filter((id): id is string => Boolean(id))),
  )

  const [classes, teachers, counts] = await Promise.all([
    classIds.length
      ? prisma.class.findMany({
          where: { id: { in: classIds } },
          select: { id: true, name: true, level: true, isActive: true },
        })
      : [],
    teacherIds.length
      ? prisma.user.findMany({
          where: { id: { in: teacherIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [],
    classIds.length
      ? prisma.student.groupBy({
          by: ["classId"],
          where: { classId: { in: classIds }, isActive: true },
          _count: { _all: true },
        })
      : [],
  ])

  const classMap = new Map<string, { id: string; name: string; level: string | null; isActive: boolean }>(
    classes.map((c) => [c.id, { id: c.id, name: c.name, level: c.level ?? null, isActive: Boolean(c.isActive) }]),
  )

  const teacherMap = new Map<string, { id: string; name: string; email: string }>(
    teachers.filter((t) => t.role === "TEACHER").map((t) => [t.id, { id: t.id, name: t.name, email: t.email }]),
  )

  const countMap = new Map<string, number>(
    counts.filter((r) => r.classId).map((r) => [r.classId!, r._count._all]),
  )

  return NextResponse.json(
    courses.map((course) => {
      const clsId = course.classId ?? null
      const tid = course.teacherId ?? null
      return {
        id: course.id,
        name: course.name,
        classId: clsId,
        class: clsId ? classMap.get(clsId) ?? null : null,
        teacherId: tid,
        teacher: tid ? teacherMap.get(tid) ?? null : null,
        status: course.status ?? "ACTIVE",
        studentsCount: clsId ? countMap.get(clsId) ?? 0 : 0,
        createdAt: course.createdAt ?? null,
        updatedAt: course.updatedAt ?? null,
      }
    }),
  )
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { name, classId, teacherId, status } = body as {
    name?: unknown
    classId?: unknown
    teacherId?: unknown
    status?: unknown
  }

  if (typeof name !== "string" || !name.trim()) return NextResponse.json({ message: "Course name is required" }, { status: 400 })
  if (typeof classId !== "string" || !classId) return NextResponse.json({ message: "classId is required" }, { status: 400 })

  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } })
  if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 400 })

  const tid = typeof teacherId === "string" && teacherId ? teacherId : null
  if (tid) {
    const teacher = await prisma.user.findUnique({
      where: { id: tid },
      select: { role: true, isActive: true },
    })
    if (!teacher || !teacher.isActive || teacher.role !== "TEACHER") {
      return NextResponse.json({ message: "Teacher not found" }, { status: 400 })
    }
  }

  const courseStatus: CourseStatus = isCourseStatus(status) ? status : "ACTIVE"
  const inserted = await prisma.course.create({
    data: {
      name: name.trim(),
      classId,
      teacherId: tid,
      status: courseStatus,
    },
  })

  const studentsCount = await prisma.student.count({ where: { classId, isActive: true } })

  return NextResponse.json(
    {
      id: inserted.id,
      name: name.trim(),
      classId,
      teacherId: tid,
      status: courseStatus,
      studentsCount,
    },
    { status: 201 },
  )
}
