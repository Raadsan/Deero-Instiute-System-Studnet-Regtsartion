import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies, financeRoleFilter } from "@/lib/auth"
import { requireAdminSession } from "@/lib/finance-auth"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionFromRequestCookies()
  const auth = requireAdminSession(session)
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { name, email, password, isActive } = body as {
    name?: unknown
    email?: unknown
    password?: unknown
    isActive?: unknown
  }

  const update: { name?: string; email?: string; password?: string; isActive?: boolean } = {}
  if (typeof name === "string") update.name = name.trim()
  if (typeof email === "string") update.email = email.trim().toLowerCase()
  if (typeof isActive === "boolean") update.isActive = isActive
  if (typeof password === "string" && password.length) {
    if (password.length < 6) return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 })
    update.password = await bcrypt.hash(password, 10)
  }

  if (typeof update.email === "string") {
    const existing = await prisma.user.findFirst({ where: { email: update.email, NOT: { id } }, select: { id: true } })
    if (existing) return NextResponse.json({ message: "Email already in use" }, { status: 409 })
  }

  const existingUser = await prisma.user.findFirst({ where: { id, ...financeRoleFilter() }, select: { id: true } })
  if (!existingUser) return NextResponse.json({ message: "Finance user not found" }, { status: 404 })

  const updated = await prisma.user.update({
    where: { id },
    data: update,
    select: { id: true, name: true, email: true, isActive: true },
  })

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    isActive: Boolean(updated.isActive),
  })
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionFromRequestCookies()
  const auth = requireAdminSession(session)
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const existingUser = await prisma.user.findFirst({ where: { id, ...financeRoleFilter() }, select: { id: true } })
  if (!existingUser) return NextResponse.json({ message: "Finance user not found" }, { status: 404 })

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
