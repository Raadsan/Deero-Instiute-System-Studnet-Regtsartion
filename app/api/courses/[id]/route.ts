import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"

type RouteContext = { params: Promise<{ id: string }> }
type CourseStatus = "ACTIVE" | "SCHEDULED" | "INACTIVE"

function isCourseStatus(value: unknown): value is CourseStatus {
  return value === "ACTIVE" || value === "SCHEDULED" || value === "INACTIVE"
}

export async function GET(_: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { id } = await params
  const course = await prisma.course.findUnique({ where: { id } })
  if (!course) return NextResponse.json({ message: "Course not found" }, { status: 404 })

  return NextResponse.json(course)
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { name, classId, teacherId, status } = body as {
    name?: unknown
    classId?: unknown
    teacherId?: unknown
    status?: unknown
  }

  const update: { name?: string; classId?: string; teacherId?: string | null; status?: CourseStatus } = {}

  if (typeof name === "string") update.name = name.trim()

  if (typeof classId === "string") {
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, isActive: true } })
    if (!cls?.isActive) return NextResponse.json({ message: "Select an active class" }, { status: 400 })
    update.classId = classId
  }

  if (teacherId === null) {
    update.teacherId = null
  } else if (typeof teacherId === "string") {
    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { role: true, isActive: true },
    })
    if (!teacher || !teacher.isActive || teacher.role !== "TEACHER") {
      return NextResponse.json({ message: "Teacher not found" }, { status: 400 })
    }
    update.teacherId = teacherId
  }

  if (status !== undefined) {
    if (!isCourseStatus(status)) return NextResponse.json({ message: "Invalid status" }, { status: 400 })
    update.status = status
  }

  try {
    const updated = await prisma.course.update({ where: { id }, data: update })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ message: "Course not found" }, { status: 404 })
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { id } = await params
  try {
    await prisma.course.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ message: "Course not found" }, { status: 404 })
  }
}
