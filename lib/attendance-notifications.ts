import { getBrandName } from "@/lib/brand"

export const CONSECUTIVE_ABSENCE_THRESHOLD = 2

export function isNewConsecutiveAbsenceStreak(statusesNewestFirst: string[]) {
  if (statusesNewestFirst.length < CONSECUTIVE_ABSENCE_THRESHOLD) return false
  const reachedThreshold = statusesNewestFirst
    .slice(0, CONSECUTIVE_ABSENCE_THRESHOLD)
    .every((status) => status === "ABSENT")
  const previousStatus = statusesNewestFirst[CONSECUTIVE_ABSENCE_THRESHOLD]
  return reachedThreshold && previousStatus !== "ABSENT"
}

export function buildConsecutiveAbsenceSms(args: { firstName: string; className: string }) {
  const studentName = args.firstName.trim() || "Arday"
  return `${getBrandName()}: Mudane ${studentName}, waxaad ka maqneyd 2 cashar oo xiriir ah (${args.className}). Fadlan la xiriir maamulka haddii ay jirto sabab. Mahadsanid.`
}
