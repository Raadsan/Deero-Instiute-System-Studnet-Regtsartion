const INSTITUTE_TIME_ZONE = "Africa/Nairobi"
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000

export function parseInstituteDay(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const utcStart = Date.UTC(year, month - 1, day) - NAIROBI_OFFSET_MS
  const start = new Date(utcStart)
  if (formatInstituteDate(start) !== value) return null
  return { start, end: new Date(utcStart + 24 * 60 * 60 * 1000) }
}

export function parseInstituteMonth(value: string | null) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null
  const [year, month] = value.split("-").map(Number)
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - NAIROBI_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - NAIROBI_OFFSET_MS),
  }
}

export function formatInstituteDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INSTITUTE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}
