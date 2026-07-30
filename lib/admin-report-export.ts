import { formatMoney } from "@/lib/finance-utils"
import { getBrandName } from "@/lib/brand"
import {
  buildBrandedPdfDocument,
  buildStructuredCsv,
  formatExportDate,
} from "@/lib/document-export"
import type { AdminSystemReport } from "@/lib/admin-report-service"

function cell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ""
  return String(value)
}

const TX_COLUMNS = [
  { header: "Date", width: 68 },
  { header: "Category", width: 88 },
  { header: "Name", width: 100 },
  { header: "Description", width: 120 },
  { header: "Type", width: 52 },
  { header: "Amount", width: 72, align: "right" as const },
]

export function buildAdminReportCsv(report: AdminSystemReport) {
  const brand = getBrandName()
  const stamp = formatExportDate(new Date())

  return buildStructuredCsv([
    {
      rows: [
        [`${brand} — Admin System Report`],
        ["Period", report.range.label],
        ["From", formatExportDate(report.range.from)],
        ["To", formatExportDate(report.range.to)],
        ["Generated", stamp],
      ],
    },
    {
      title: "Overview",
      rows: [
        ["Metric", "Value"],
        ["Total Students", cell(report.overview.totalStudents)],
        ["Enrolled Students", cell(report.overview.enrolledStudents)],
        ["Visit Scheduled", cell(report.overview.visitScheduledStudents)],
        ["Paid Students", cell(report.overview.paidStudents)],
        ["Unpaid Students", cell(report.overview.unpaidStudents)],
        ["Total Teachers", cell(report.overview.totalTeachers)],
        ["Total Classes", cell(report.overview.totalClasses)],
        ["Attendance Rate (7d)", `${report.overview.attendanceRate.toFixed(1)}%`],
      ],
    },
    {
      title: "Money Summary",
      rows: [
        ["Metric", "All Time / Period", "This Month"],
        ["Student Fees", cell(report.money.studentFeesAllTime), cell(report.money.studentFeesThisMonth)],
        ["Student Fees (Period)", cell(report.money.studentFeesPeriod), ""],
        ["Teacher Payouts (Period)", cell(report.money.teacherPayoutsPeriod), cell(report.money.teacherPayoutsThisMonth)],
        ["Partner Payouts (Period)", cell(report.money.partnerPayoutsPeriod), cell(report.money.partnerPayoutsThisMonth)],
        ["Manual Income (Period)", cell(report.money.manualIncomePeriod), ""],
        ["Manual Expense (Period)", cell(report.money.manualExpensePeriod), ""],
        ["Total Income (Period)", cell(report.money.totalIncomePeriod), ""],
        ["Total Expenses (Period)", cell(report.money.totalExpensesPeriod), ""],
        ["Net Balance (Period)", cell(report.money.netBalancePeriod), ""],
        ["Teacher Balance Due", cell(report.money.teacherBalanceDue), ""],
        ["Partner Balance Due", cell(report.money.partnerBalanceDue), ""],
      ],
    },
    {
      title: "Unpaid Students",
      rows: [
        ["Name", "Class", "Phone"],
        ...report.unpaidStudents.map((row) => [row.name, row.className ?? "", row.phone ?? ""]),
      ],
    },
    {
      title: "Visit Scheduled",
      rows: [
        ["Name", "Visit Date", "Phone", "Note"],
        ...report.visitScheduled.map((row) => [
          row.name,
          row.visitDate ? formatExportDate(row.visitDate) : "",
          row.phone ?? "",
          row.visitNote ?? "",
        ]),
      ],
    },
    {
      title: "Attendance By Class",
      rows: [
        ["Class", "Present", "Absent", "Absent Rate %"],
        ...report.attendanceByClass.map((row) => [row.className, cell(row.present), cell(row.absent), cell(row.absentRate)]),
      ],
    },
    {
      title: "Teacher Payroll",
      rows: [
        ["Name", "Monthly Pay", "Paid Out", "Balance Due", "Contracts"],
        ...report.payroll.teachers.map((row) => [
          row.name,
          cell(row.monthlyPay),
          cell(row.totalPaidOut),
          cell(row.balanceDue),
          cell(row.contractsCount),
        ]),
      ],
    },
    {
      title: "Partner Payroll",
      rows: [
        ["Name", "Monthly Due", "Paid Out", "Balance Due", "Students"],
        ...report.payroll.partners.map((row) => [
          row.name,
          cell(row.monthlyDue),
          cell(row.totalPaidOut),
          cell(row.balanceDue),
          cell(row.studentsCount),
        ]),
      ],
    },
    {
      title: "Financial Transactions",
      rows: [
        ["Date", "Category", "Name", "Description", "Type", "Amount"],
        ...report.transactions.map((row) => [
          formatExportDate(row.date),
          row.category,
          row.name,
          row.description,
          row.direction,
          cell(row.amount),
        ]),
      ],
    },
  ])
}

export async function buildAdminReportPdf(report: AdminSystemReport) {
  const brand = getBrandName()
  const stamp = formatExportDate(new Date())

  const tableRows: string[][] = report.transactions.map((row) => [
    formatExportDate(row.date),
    row.category,
    row.name,
    row.description,
    row.direction === "income" ? "Income" : "Expense",
    formatMoney(row.amount),
  ])

  return buildBrandedPdfDocument({
    title: "Admin System Report",
    subtitle: `${brand} · ${report.range.label} · Generated ${stamp}`,
    summary: [
      { label: "Total Students", value: String(report.overview.totalStudents) },
      { label: "Unpaid Students", value: String(report.overview.unpaidStudents), highlight: true },
      { label: "Visit Scheduled", value: String(report.overview.visitScheduledStudents) },
      { label: "Attendance Rate (7d)", value: `${report.overview.attendanceRate.toFixed(1)}%` },
      { label: "Student Fees (Period)", value: formatMoney(report.money.studentFeesPeriod) },
      { label: "Student Fees (This Month)", value: formatMoney(report.money.studentFeesThisMonth), highlight: true },
      { label: "Teacher Payouts (Period)", value: formatMoney(report.money.teacherPayoutsPeriod) },
      { label: "Partner Payouts (Period)", value: formatMoney(report.money.partnerPayoutsPeriod) },
      { label: "Total Income (Period)", value: formatMoney(report.money.totalIncomePeriod), highlight: true },
      { label: "Total Expenses (Period)", value: formatMoney(report.money.totalExpensesPeriod), highlight: true },
      { label: "Net Balance (Period)", value: formatMoney(report.money.netBalancePeriod), highlight: true },
      { label: "Outstanding — Teachers", value: formatMoney(report.money.teacherBalanceDue) },
      { label: "Outstanding — Partners", value: formatMoney(report.money.partnerBalanceDue) },
    ],
    columns: TX_COLUMNS,
    rows: tableRows,
    emptyMessage: "No financial transactions in this period.",
  })
}
