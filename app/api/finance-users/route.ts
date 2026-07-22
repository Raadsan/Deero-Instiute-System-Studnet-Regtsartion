import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies, financeRoleFilter } from "@/lib/auth"
import { requireAdminSession } from "@/lib/finance-auth"

export async function GET(req: Request) {
  const session = await getSessionFromRequestCookies()
  const auth = requireAdminSession(session)
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const includeInactive = searchParams.get("includeInactive") === "true"

  const users = await prisma.user.findMany({
    where: {
      ...financeRoleFilter(),
      ...(includeInactive ? {} : { isActive: true }),
    },
    select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: Boolean(user.isActive),
      createdAt: user.createdAt.toISOString(),
    })),
  )
}

export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies()
  const auth = requireAdminSession(session)
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { name, email, password } = body as {
    name?: unknown
    email?: unknown
    password?: unknown
  }

  if (typeof name !== "string" || !name.trim()) return NextResponse.json({ message: "Name is required" }, { status: 400 })
  if (typeof email !== "string" || !email.trim()) return NextResponse.json({ message: "Email is required" }, { status: 400 })
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
  if (existing) return NextResponse.json({ message: "Email already in use" }, { status: 409 })

  const passwordHash = await bcrypt.hash(password, 10)
  const inserted = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: passwordHash,
      role: "FINANCE",
      isActive: true,
    },
  })

  return NextResponse.json(
    {
      id: inserted.id,
      name: name.trim(),
      email: normalizedEmail,
      isActive: true,
    },
    { status: 201 },
  )
}
