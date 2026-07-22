import { addMonths, startOfMonth } from "@/lib/finance-utils"

export type FinanceReportPeriod = "3m" | "6m" | "1y" | string

export type FinanceReportCategory = "all" | "students" | "teachers" | "partners" | "staff" | "classes"

export function resolveReportDateRange(input: { period?: string | null; month?: string | null }) {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  let start: Date

  const month = input.month?.trim()
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mon] = month.split("-").map(Number)
    start = new Date(year, mon - 1, 1, 0, 0, 0, 0)
    return {
      from: start,
      to: new Date(year, mon, 0, 23, 59, 59, 999),
      label: month,
    }
  }

  const period = input.period ?? "3m"
  if (period === "6m") {
    start = addMonths(startOfMonth(now), -5)
  } else if (period === "1y") {
    start = addMonths(startOfMonth(now), -11)
  } else {
    start = addMonths(startOfMonth(now), -2)
  }

  return {
    from: start,
    to: end,
    label: period,
  }
}

export function formatMoneyPlain(amount: number) {
  return amount.toFixed(2)
}

export function csvEscape(value: unknown) {
  const str = value === null || value === undefined ? "" : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function csvRow(...values: unknown[]) {
  return values.map(csvEscape).join(",")
}
