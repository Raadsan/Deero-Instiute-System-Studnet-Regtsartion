import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies, normalizeRole } from "@/lib/auth"
import { getAllowedRoutesForRole } from "@/lib/permissions"

export async function GET() {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })

  if (!user || !user.isActive) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const role = normalizeRole(user.role)
  if (!role) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const allowedRoutes = await getAllowedRoutesForRole(role)
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    allowedRoutes,
  })
}

export async function PATCH(req: Request) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const name =
    body && typeof body === "object" && typeof (body as { name?: unknown }).name === "string"
      ? (body as { name: string }).name.trim().replace(/\s+/g, " ")
      : ""

  if (name.length < 2 || name.length > 100) {
    return NextResponse.json(
      { message: "Name must be between 2 and 100 characters" },
      { status: 400 },
    )
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name },
    select: { id: true, name: true, email: true, role: true },
  })

  return NextResponse.json({
    ...updated,
    role: session.role,
  })
}
