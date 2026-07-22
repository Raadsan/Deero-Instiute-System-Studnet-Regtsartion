import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { enqueueAndSendEmailMessage } from "@/lib/email-queue"
import { buildBroadcastEmailTemplate } from "@/lib/email-templates"
import { getBrandName } from "@/lib/brand"

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { studentId, subject, message } = body as {
    studentId?: unknown
    subject?: unknown
    message?: unknown
  }

  if (typeof studentId !== "string" || !studentId) return NextResponse.json({ message: "studentId is required" }, { status: 400 })
  if (typeof subject !== "string" || !subject.trim()) return NextResponse.json({ message: "subject is required" }, { status: 400 })
  if (typeof message !== "string" || !message.trim()) return NextResponse.json({ message: "message is required" }, { status: 400 })

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { email: true, firstName: true, lastName: true },
  })
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 })

  const personalSubject = subject.trim().replace(/\[\[name\]\]/g, student.firstName || "Student")
  const personalMessage = message.trim().replace(/\[\[name\]\]/g, student.firstName || "Student")

  const template = buildBroadcastEmailTemplate({
    subject: personalSubject,
    message: personalMessage,
    contextTitle: personalSubject,
    contextSubtitle: `Personal notification for ${student.firstName} ${student.lastName}`,
    logoCid: "brandlogo",
    brandName: getBrandName(),
  })

  const result = await enqueueAndSendEmailMessage({
    to: student.email ?? null,
    subject: personalSubject,
    text: template.text,
    html: template.html,
    meta: { kind: "BROADCAST", initiatedBy: session.userId, classId: "single", courseId: null },
  })

  if (!result.ok) {
    return NextResponse.json({ message: result.error || "Failed to send email" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: result.status })
}
