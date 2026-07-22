/** JavaScript weekday: 0 = Sunday, 1 = Monday, ... 6 = Saturday */
export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Mon", fullLabel: "Monday" },
  { value: 2, label: "Tue", fullLabel: "Tuesday" },
  { value: 3, label: "Wed", fullLabel: "Wednesday" },
  { value: 4, label: "Thu", fullLabel: "Thursday" },
  { value: 5, label: "Fri", fullLabel: "Friday" },
  { value: 6, label: "Sat", fullLabel: "Saturday" },
  { value: 0, label: "Sun", fullLabel: "Sunday" },
] as const

const weekdayLabelMap = new Map(WEEKDAY_OPTIONS.map((d) => [d.value, d.label]))
const weekdayFullMap = new Map(WEEKDAY_OPTIONS.map((d) => [d.value, d.fullLabel]))

export function parseScheduleDays(input: unknown): number[] | null {
  if (!Array.isArray(input)) return null
  const valid = input
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6)
  const unique = Array.from(new Set(valid)).sort((a, b) => a - b)
  if (!unique.length) return null
  return unique
}

export function isClassScheduledOnDate(scheduleDays: number[], date: Date): boolean {
  if (!scheduleDays.length) return false
  return scheduleDays.includes(date.getDay())
}

export function formatScheduleDays(scheduleDays: number[]): string {
  if (!scheduleDays.length) return "Not set"
  return scheduleDays.map((d) => weekdayLabelMap.get(d) ?? "?").join(", ")
}

export function formatScheduleDaysFull(scheduleDays: number[]): string {
  if (!scheduleDays.length) return "Not set"
  return scheduleDays.map((d) => weekdayFullMap.get(d) ?? "?").join(", ")
}

/** Pick today if it is a class day, otherwise the next class day within 14 days. */
export function getDefaultAttendanceDate(scheduleDays: number[], from = new Date()): string {
  const base = new Date(from)
  base.setHours(0, 0, 0, 0)

  if (!scheduleDays.length) {
    return formatDateInputValue(base)
  }

  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(base)
    candidate.setDate(base.getDate() + offset)
    if (scheduleDays.includes(candidate.getDay())) {
      return formatDateInputValue(candidate)
    }
  }

  return formatDateInputValue(base)
}

export function formatDateInputValue(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function isDateInputOnSchedule(scheduleDays: number[], dateInput: string): boolean {
  if (!scheduleDays.length) return false
  const weekday = getWeekdayFromDateInput(dateInput)
  if (weekday === null) return false
  return scheduleDays.includes(weekday)
}

export function getWeekdayFromDateInput(value: string): number | null {
  const parts = value.split("-").map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null
  const [year, month, day] = parts
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return date.getDay()
}
