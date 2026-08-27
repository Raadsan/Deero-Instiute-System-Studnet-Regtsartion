export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "LEAVE"] as const

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export const ATTENDANCE_STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "EXCUSED", label: "Excused" },
  { value: "LEAVE", label: "Leave" },
]

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && ATTENDANCE_STATUSES.some((status) => status === value)
}

export function countsAsAttended(status: string) {
  return status === "PRESENT" || status === "LATE"
}

export function countsTowardAttendanceRate(status: string) {
  return countsAsAttended(status) || status === "ABSENT"
}

export function calculateAttendancePercentage(present: number, late: number, absent: number) {
  const attended = present + late
  const eligiblePeriods = attended + absent
  if (eligiblePeriods <= 0) return null
  const value = (attended / eligiblePeriods) * 100
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100))
}
