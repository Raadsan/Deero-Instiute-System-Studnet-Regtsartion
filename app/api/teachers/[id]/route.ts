import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { isPasswordValid } from "@/lib/password-utils"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { name, email, password, isActive, classIds } = body as {
    name?: unknown
    email?: unknown
    password?: unknown
    isActive?: unknown
    classIds?: unknown
  }

  const update: { name?: string; email?: string; password?: string; isActive?: boolean } = {}

  if (typeof name === "string") update.name = name.trim()
  if (typeof email === "string") update.email = email.trim().toLowerCase()
  if (typeof isActive === "boolean") update.isActive = isActive
  if (typeof password === "string" && password.length) {
    if (!isPasswordValid(password)) {
      return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 })
    }
    update.password = await bcrypt.hash(password, 10)
  }

  if (typeof update.email === "string") {
    const existing = await prisma.user.findFirst({
      where: { email: update.email, NOT: { id } },
      select: { id: true },
    })
    if (existing) return NextResponse.json({ message: "Email already in use" }, { status: 409 })
  }

  const existingTeacher = await prisma.user.findFirst({
    where: { id, role: "TEACHER" },
    select: { id: true },
  })
  if (!existingTeacher) return NextResponse.json({ message: "Teacher not found" }, { status: 404 })

  const updated = await prisma.user.update({
    where: { id },
    data: update,
    select: { id: true, name: true, email: true, isActive: true },
  })

  const teacherId = updated.id
  if (Array.isArray(classIds)) {
    const ids = classIds.filter((x): x is string => typeof x === "string")

    await prisma.class.updateMany({ where: { teacherId }, data: { teacherId: null } })
    if (ids.length) {
      await prisma.class.updateMany({ where: { id: { in: ids } }, data: { teacherId } })
    }
  }

  const classes = await prisma.class.findMany({
    where: { teacherId },
    select: { id: true, name: true, level: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({
    id: teacherId,
    name: updated.name,
    email: updated.email,
    isActive: Boolean(updated.isActive),
    classes: classes.map((c) => ({ id: c.id, name: c.name, level: c.level ?? null })),
  })
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const teacher = await prisma.user.findFirst({
    where: { id, role: "TEACHER" },
    select: { id: true },
  })
  if (!teacher) return NextResponse.json({ message: "Teacher not found" }, { status: 404 })

  const teacherId = teacher.id

  await prisma.class.updateMany({ where: { teacherId }, data: { teacherId: null } })
  await prisma.course.updateMany({ where: { teacherId }, data: { teacherId: null } })

  await prisma.user.delete({ where: { id: teacherId } })

  return NextResponse.json({ ok: true })
}
