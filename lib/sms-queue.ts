import { prisma } from "@/lib/prisma"
import { normalizeSmsMobile, sendHormuudSms } from "@/lib/sms-hormuud"

export type SmsMessageStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED"

export type SmsQueueMeta =
  | { kind: "BROADCAST"; initiatedBy: string; classId: string; courseId?: string | null; studentId?: string }
  | {
      kind: "ABSENCE_ALERT"
      studentId: string
      classId: string
      consecutiveAbsences: number
      streakStartDate: string
      streakEndDate: string
    }
  | { kind: "VISIT_CONFIRMATION"; studentId: string; visitDate: string; initiatedBy: string }
  | { kind: "VISIT_REMINDER"; studentId: string; visitDate: string; initiatedBy: string }

export async function enqueueAndSendSms(args: {
  to: string | null
  body: string
  meta: SmsQueueMeta
}) {
  const normalized = args.to ? normalizeSmsMobile(args.to) : null
  if (!normalized) {
    const inserted = await prisma.smsMessage.create({
      data: {
        to: args.to,
        body: args.body,
        meta: args.meta,
        status: "SKIPPED",
        error: "Missing/invalid phone number",
        sentAt: null,
      },
    })
    return { ok: true as const, status: "SKIPPED" as const, id: inserted.id }
  }

  const inserted = await prisma.smsMessage.create({
    data: {
      to: normalized,
      body: args.body,
      meta: args.meta,
      status: "PENDING",
      error: null,
      sentAt: null,
    },
  })

  const result = await sendHormuudSms(normalized, args.body)
  if (result.ok) {
    await prisma.smsMessage.update({
      where: { id: inserted.id },
      data: { status: "SENT", sentAt: new Date(), providerMessageId: result.messageId ?? null },
    })
    return { ok: true as const, status: "SENT" as const, id: inserted.id }
  }

  await prisma.smsMessage.update({
    where: { id: inserted.id },
    data: { status: "FAILED", error: result.error, sentAt: new Date() },
  })
  return { ok: false as const, status: "FAILED" as const, id: inserted.id, error: result.error }
}

export async function hasAbsenceSmsAlert(args: {
  studentId: string
  classId: string
  streakEndDate: string
}) {
  const existing = await prisma.smsMessage.findFirst({
    where: {
      status: { in: ["SENT", "PENDING"] },
      AND: [
        { meta: { path: ["kind"], equals: "ABSENCE_ALERT" } },
        { meta: { path: ["studentId"], equals: args.studentId } },
        { meta: { path: ["classId"], equals: args.classId } },
        { meta: { path: ["streakEndDate"], equals: args.streakEndDate } },
      ],
    },
    select: { id: true },
  })
  return Boolean(existing)
}

export async function hasVisitSmsReminder(args: { studentId: string; visitDate: string }) {
  const existing = await prisma.smsMessage.findFirst({
    where: {
      status: { in: ["SENT", "PENDING"] },
      AND: [
        { meta: { path: ["kind"], equals: "VISIT_REMINDER" } },
        { meta: { path: ["studentId"], equals: args.studentId } },
        { meta: { path: ["visitDate"], equals: args.visitDate } },
      ],
    },
    select: { id: true },
  })
  return Boolean(existing)
}
