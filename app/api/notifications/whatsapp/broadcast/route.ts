import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { enqueueAndSendWhatsAppMessage } from "@/lib/whatsapp-queue"

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequestCookies()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    const body: unknown = await req.json()
    if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

    const { message, classId, courseId } = body as { message?: unknown; classId?: unknown; courseId?: unknown }

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ message: "message is required" }, { status: 400 })
    }

    let resolvedClassId: string | null = null
    let resolvedCourseId: string | null = null

    if (typeof courseId === "string" && courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { classId: true, status: true },
      })
      if (!course) return NextResponse.json({ message: "Course not found" }, { status: 404 })
      if (course.status !== "ACTIVE") {
        return NextResponse.json({ message: "Only active courses can receive broadcasts" }, { status: 400 })
      }
      resolvedCourseId = courseId
      resolvedClassId = course.classId ?? null
    }

    if (!resolvedClassId && typeof classId === "string" && classId) {
      const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } })
      if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 })
      resolvedClassId = classId
    }

    if (!resolvedClassId) return NextResponse.json({ message: "classId or courseId is required" }, { status: 400 })

    const students = await prisma.student.findMany({
      where: { classId: resolvedClassId, isActive: true },
      select: { phone: true, firstName: true },
    })

    const results = await Promise.all(
      students.map((s) => {
        const personalMessage = message.trim().replace(/\[\[name\]\]/g, s.firstName || "Student")
        return enqueueAndSendWhatsAppMessage({
          to: s.phone ?? null,
          body: personalMessage,
          meta: {
            kind: "BROADCAST",
            initiatedBy: session.userId,
            classId: resolvedClassId!,
            courseId: resolvedCourseId,
          },
        })
      }),
    )

    const sent = results.filter((r) => r.ok && r.status === "SENT").length
    const skipped = results.filter((r) => r.ok && r.status === "SKIPPED").length
    const failed = results.filter((r) => !r.ok).length

    return NextResponse.json({
      ok: true,
      classId: resolvedClassId,
      courseId: resolvedCourseId,
      total: results.length,
      sent,
      skipped,
      failed,
    })
  } catch (error: unknown) {
    console.error("WhatsApp broadcast error:", error)
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Internal server error during broadcast",
    }, { status: 500 })
  }
}
