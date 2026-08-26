import { NextRequest, NextResponse } from "next/server"

import { getSessionFromRequestCookies } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body: unknown = await req.json()
  if (!body || typeof body !== "object" || typeof (body as { isHidden?: unknown }).isHidden !== "boolean") {
    return NextResponse.json({ message: "isHidden must be a boolean" }, { status: 400 })
  }

  const { id } = await params
  const existing = await prisma.student.findUnique({
    where: { id },
    select: { id: true, classId: true },
  })
  if (!existing) return NextResponse.json({ message: "Student not found" }, { status: 404 })

  const isHidden = (body as { isHidden: boolean }).isHidden
  const student = await prisma.student.update({
    where: { id },
    // Deliberately leave classId unchanged so unhide restores the same class.
    data: { isHidden },
    select: { id: true, isHidden: true, classId: true, updatedAt: true },
  })

  return NextResponse.json(student)
}
