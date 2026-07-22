import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { sendHormuudSms } from "@/lib/sms-hormuud"

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
      select: { phone: true, firstName: true },
    })
    if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 })

    if (!student.phone) {
      return NextResponse.json({ message: "Student has no phone number" }, { status: 400 })
    }

    const personalMessage = message.trim().replace(/\[\[name\]\]/g, student.firstName || "Student")
    const result = await sendHormuudSms(student.phone, personalMessage)

    if (!result.ok) {
      return NextResponse.json(
        {
          message: result.error || "Failed to send SMS",
          error: result.error,
          responseCode: result.responseCode,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
    })
  } catch (error: unknown) {
    console.error("SMS single error:", error)
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Internal server error during SMS send",
      },
      { status: 500 },
    )
  }
}
