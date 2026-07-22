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

    const { message, studentId } = body as { message?: unknown; studentId?: unknown }

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ message: "message is required" }, { status: 400 })
    }

    if (typeof studentId !== "string" || !studentId) {
      return NextResponse.json({ message: "studentId is required" }, { status: 400 })
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { phone: true, classId: true, firstName: true },
    })
    if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 })

    const personalMessage = message.trim().replace(/\[\[name\]\]/g, student.firstName || "Student")

    const result = await enqueueAndSendWhatsAppMessage({
      to: student.phone ?? null,
      body: personalMessage,
      meta: {
        kind: "BROADCAST",
        initiatedBy: session.userId,
        classId: student.classId ?? "unknown",
      },
    })

    if (!result.ok) {
      return NextResponse.json({
        message: result.error || "Failed to send WhatsApp",
        error: result.error,
        status: result.status,
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      id: result.id,
    })
  } catch (error: unknown) {
    console.error("WhatsApp single error:", error)
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Internal server error during WhatsApp send",
      stack: process.env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
