import { prisma } from "@/lib/prisma"
import { buildVisitConfirmationMessage, buildVisitDayReminderMessage, startOfDay } from "@/lib/visit-messages"
import { enqueueAndSendSms, hasVisitSmsReminder } from "@/lib/sms-queue"

export type EnrollmentStatus = "ENROLLED" | "VISIT_SCHEDULED"

export async function sendVisitConfirmationSms(args: {
  studentId: string
  phone: string | null
  firstName: string
  visitDate: Date
  initiatedBy?: string
}) {
  if (!args.phone?.trim()) {
    return { ok: false as const, status: "SKIPPED" as const, reason: "Missing phone" }
  }

  const body = buildVisitConfirmationMessage({
    firstName: args.firstName,
    visitDate: args.visitDate,
  })

  return enqueueAndSendSms({
    to: args.phone,
    body,
    meta: {
      kind: "VISIT_CONFIRMATION",
      studentId: args.studentId,
      visitDate: args.visitDate.toISOString(),
      initiatedBy: args.initiatedBy ?? "system",
    },
  })
}

export async function processVisitReminders() {
  const todayStart = startOfDay(new Date())
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  const students = await prisma.student.findMany({
    where: {
      enrollmentStatus: "VISIT_SCHEDULED",
      visitDate: { gte: todayStart, lt: tomorrowStart },
      visitReminderSentAt: null,
    },
  })

  const results: Array<{
    studentId: string
    name: string
    status: string
    error?: string
  }> = []

  for (const student of students) {
    const studentId = student.id
    const firstName = student.firstName ?? "Student"
    const phone = student.phone ?? null
    const visitDate = student.visitDate!

    if (await hasVisitSmsReminder({ studentId, visitDate: visitDate.toISOString() })) {
      results.push({ studentId, name: firstName, status: "SKIPPED" })
      continue
    }

    const body = buildVisitDayReminderMessage({ firstName })
    const result = await enqueueAndSendSms({
      to: phone,
      body,
      meta: {
        kind: "VISIT_REMINDER",
        studentId,
        visitDate: visitDate.toISOString(),
        initiatedBy: "cron",
      },
    })

    if (result.status === "SENT") {
      await prisma.student.update({
        where: { id: studentId },
        data: { visitReminderSentAt: new Date() },
      })
    }

    results.push({
      studentId,
      name: firstName,
      status: result.status,
      error: "error" in result ? result.error : undefined,
    })
  }

  return {
    date: todayStart.toISOString(),
    total: students.length,
    sent: results.filter((r) => r.status === "SENT").length,
    failed: results.filter((r) => r.status === "FAILED").length,
    skipped: results.filter((r) => r.status === "SKIPPED").length,
    results,
  }
}
