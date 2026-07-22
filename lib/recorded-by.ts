import type { Role } from "@/lib/generated/prisma/client"

export const recordedBySelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const

export type RecordedByUser = {
  id: string
  name: string
  email: string
  role: Role
}

export type RecordedByPayload = RecordedByUser | null

export function mapRecordedBy(user: RecordedByUser | null | undefined): RecordedByPayload {
  if (!user) return null
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

export function formatRecordedByLabel(user: RecordedByPayload) {
  if (!user) return "Unknown"
  return `${user.name} (${user.role.toLowerCase()})`
}

export function mapPayoutResponse(payout: {
  id: string
  amount: number
  currency: string
  paidAt: Date
  note: string | null
  period: string | null
  recordedBy?: RecordedByUser | null
}) {
  return {
    id: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    paidAt: payout.paidAt.toISOString(),
    note: payout.note,
    period: payout.period,
    recordedBy: mapRecordedBy(payout.recordedBy ?? null),
  }
}
