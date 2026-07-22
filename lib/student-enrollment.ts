import { parseVisitDateInput } from "@/lib/visit-messages"
import type { EnrollmentStatus } from "@/lib/visit-reminders"

export type StudentEnrollmentInput = {
  enrollmentStatus?: EnrollmentStatus | string
  visitDate?: string | Date | null
  visitNote?: string | null
}

export type ParsedStudentEnrollment = {
  enrollmentStatus: EnrollmentStatus
  visitDate: Date | null
  visitNote: string | null
  visitReminderSentAt: Date | null | undefined
}

export function parseStudentEnrollmentInput(
  body: StudentEnrollmentInput,
  existing?: {
    enrollmentStatus?: string
    visitDate?: Date | null
    visitNote?: string | null
    visitReminderSentAt?: Date | null
  },
): { ok: true; data: ParsedStudentEnrollment } | { ok: false; message: string } {
  const enrollmentStatus =
    body.enrollmentStatus === "VISIT_SCHEDULED" || body.enrollmentStatus === "ENROLLED"
      ? body.enrollmentStatus
      : existing?.enrollmentStatus === "VISIT_SCHEDULED"
        ? "VISIT_SCHEDULED"
        : "ENROLLED"

  let visitDate: Date | null = null
  if (body.visitDate instanceof Date) {
    visitDate = body.visitDate
  } else if (typeof body.visitDate === "string" && body.visitDate.trim()) {
    visitDate = parseVisitDateInput(body.visitDate)
    if (!visitDate) return { ok: false, message: "Invalid visitDate. Use YYYY-MM-DD." }
  } else if (body.visitDate === null) {
    visitDate = null
  } else if (enrollmentStatus === "VISIT_SCHEDULED" && existing?.visitDate) {
    visitDate = existing.visitDate instanceof Date ? existing.visitDate : new Date(existing.visitDate)
  }

  let visitNote: string | null = null
  if (enrollmentStatus === "VISIT_SCHEDULED") {
    if (typeof body.visitNote === "string") {
      visitNote = body.visitNote.trim() ? body.visitNote.trim() : null
    } else if (body.visitNote === null) {
      visitNote = null
    } else if (typeof existing?.visitNote === "string") {
      visitNote = existing.visitNote.trim() ? existing.visitNote.trim() : null
    }
  }

  if (enrollmentStatus === "VISIT_SCHEDULED") {
    if (!visitDate) return { ok: false, message: "Visit date is required for scheduled visits." }
  } else {
    visitDate = null
  }

  const existingVisitTime = existing?.visitDate ? new Date(existing.visitDate).getTime() : null
  const nextVisitTime = visitDate ? visitDate.getTime() : null
  const visitDateChanged = existingVisitTime !== nextVisitTime

  return {
    ok: true,
    data: {
      enrollmentStatus,
      visitDate: enrollmentStatus === "VISIT_SCHEDULED" ? visitDate : null,
      visitNote: enrollmentStatus === "VISIT_SCHEDULED" ? visitNote : null,
      visitReminderSentAt: visitDateChanged ? null : existing?.visitReminderSentAt ?? null,
    },
  }
}
