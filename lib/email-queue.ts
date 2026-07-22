import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import type { SendMailOptions } from "nodemailer"

export type EmailMessageStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED"

export type EmailQueueMeta =
  | { kind: "BROADCAST"; initiatedBy: string; classId: string; courseId?: string | null }
  | { kind: "ABSENCE_ALERT"; studentId: string; classId: string; absentCount: number; windowDays: number }
  | { kind: "CERTIFICATE"; initiatedBy: string; classId: string; studentId: string }

export async function enqueueAndSendEmailMessage(args: {
  to: string | null
  subject: string
  text: string
  html?: string | null
  attachments?: SendMailOptions["attachments"]
  meta: EmailQueueMeta
}) {
  const email = args.to ? String(args.to).trim() : ""
  if (!email || !email.includes("@")) {
    const inserted = await prisma.emailMessage.create({
      data: {
        to: args.to,
        subject: args.subject,
        text: args.text,
        meta: args.meta,
        status: "SKIPPED",
        error: "Missing/invalid email",
        sentAt: null,
      },
    })
    return { ok: true as const, status: "SKIPPED" as const, id: inserted.id }
  }

  const inserted = await prisma.emailMessage.create({
    data: {
      to: email,
      subject: args.subject,
      text: args.text,
      meta: args.meta,
      status: "PENDING",
      error: null,
      sentAt: null,
    },
  })

  const result = await sendEmail({
    to: email,
    subject: args.subject,
    text: args.text,
    html: args.html ?? null,
    attachments: args.attachments,
  })

  if (result.ok) {
    await prisma.emailMessage.update({
      where: { id: inserted.id },
      data: { status: "SENT", sentAt: new Date(), providerMessageId: result.messageId ?? null },
    })
    return { ok: true as const, status: "SENT" as const, id: inserted.id }
  }

  await prisma.emailMessage.update({
    where: { id: inserted.id },
    data: { status: "FAILED", error: result.error, sentAt: new Date() },
  })
  return { ok: false as const, status: "FAILED" as const, id: inserted.id, error: result.error }
}

export async function hasRecentAbsenceEmailAlert(args: { studentId: string; classId: string; absentCount: number; withinDays: number }) {
  const since = new Date()
  since.setDate(since.getDate() - args.withinDays)

  const existing = await prisma.emailMessage.findFirst({
    where: {
      createdAt: { gte: since },
      status: { in: ["SENT", "PENDING"] },
      AND: [
        { meta: { path: ["kind"], equals: "ABSENCE_ALERT" } },
        { meta: { path: ["studentId"], equals: args.studentId } },
        { meta: { path: ["classId"], equals: args.classId } },
        { meta: { path: ["absentCount"], equals: args.absentCount } },
      ],
    },
  })
  return Boolean(existing)
}
