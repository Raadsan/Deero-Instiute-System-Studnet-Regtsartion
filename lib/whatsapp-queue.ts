import { prisma } from "@/lib/prisma"
import { normalizeWhatsAppTo, sendWhatsAppText } from "@/lib/whatsapp"

export type WhatsAppMessageStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED"

export type WhatsAppQueueMeta =
  | { kind: "BROADCAST"; initiatedBy: string; classId: string; courseId?: string | null }
  | { kind: "ABSENCE_ALERT"; studentId: string; classId: string; absentCount: number; windowDays: number }
  | { kind: "VISIT_CONFIRMATION"; studentId: string; visitDate: string; initiatedBy: string }
  | { kind: "VISIT_REMINDER"; studentId: string; visitDate: string; initiatedBy: string }

export type EnqueueWhatsAppMessageArgs = {
  to: string | null
  body: string
  meta: WhatsAppQueueMeta
}

export async function enqueueAndSendWhatsAppMessage(args: EnqueueWhatsAppMessageArgs) {
  const normalized = args.to ? normalizeWhatsAppTo(args.to) : null
  if (!normalized) {
    const inserted = await prisma.whatsAppMessage.create({
      data: {
        to: args.to,
        body: args.body,
        meta: args.meta,
        status: "SKIPPED",
        error: "Missing/invalid phone",
        sentAt: null,
      },
    })
    return { ok: true as const, status: "SKIPPED" as const, id: inserted.id }
  }

  const inserted = await prisma.whatsAppMessage.create({
    data: {
      to: normalized,
      body: args.body,
      meta: args.meta,
      status: "PENDING",
      error: null,
      sentAt: null,
    },
  })

  const result = await sendWhatsAppText(normalized, args.body)

  if (result.ok) {
    await prisma.whatsAppMessage.update({
      where: { id: inserted.id },
      data: { status: "SENT", sentAt: new Date(), providerMessageId: result.messageId ?? null },
    })
    return { ok: true as const, status: "SENT" as const, id: inserted.id }
  }

  await prisma.whatsAppMessage.update({
    where: { id: inserted.id },
    data: {
      status: "FAILED",
      error: result.error,
      errorStatus: result.status ?? null,
      sentAt: new Date(),
    },
  })
  return { ok: false as const, status: "FAILED" as const, id: inserted.id, error: result.error }
}

export async function hasRecentVisitReminder(args: { studentId: string; visitDate: Date }) {
  const dayStart = new Date(args.visitDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const existing = await prisma.whatsAppMessage.findFirst({
    where: {
      createdAt: { gte: dayStart, lt: dayEnd },
      status: { in: ["SENT", "PENDING"] },
      AND: [
        { meta: { path: ["kind"], equals: "VISIT_REMINDER" } },
        { meta: { path: ["studentId"], equals: args.studentId } },
      ],
    },
  })
  return Boolean(existing)
}

export async function hasRecentAbsenceAlert(args: { studentId: string; classId: string; absentCount: number; withinDays: number }) {
  const since = new Date()
  since.setDate(since.getDate() - args.withinDays)

  const existing = await prisma.whatsAppMessage.findFirst({
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
