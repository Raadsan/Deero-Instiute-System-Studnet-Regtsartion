import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies, normalizeRole } from "@/lib/auth"

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

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role,
  })
}
