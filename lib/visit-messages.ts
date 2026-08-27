import { getBrandName } from "@/lib/brand"

function formatVisitDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function buildVisitConfirmationMessage(args: { firstName: string; visitDate: Date }) {
  const brand = getBrandName()
  const dateLabel = formatVisitDate(args.visitDate)
  const name = args.firstName.trim() || "there"

  return (
    `${brand}: Hello ${name}, your visit is scheduled for ${dateLabel}. ` +
    `We look forward to welcoming you. Contact the institute if you need help.`
  )
}

export function buildVisitDayReminderMessage(args: { firstName: string }) {
  const brand = getBrandName()
  const name = args.firstName.trim() || "there"

  return (
    `${brand}: Hello ${name}, this is a reminder that your planned visit is today. ` +
    `We are ready to welcome you and look forward to seeing you.`
  )
}

export function parseVisitDateInput(input: string): Date | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }

  return date
}

export function formatVisitDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getNextSaturday(from = new Date()): Date {
  const date = new Date(from)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const daysToAdd = day === 6 ? 0 : (6 - day + 7) % 7
  date.setDate(date.getDate() + daysToAdd)
  return date
}

export function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}
