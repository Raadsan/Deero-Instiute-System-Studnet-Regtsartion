import { formatMoney } from "@/lib/finance-utils"
import { getBrandName } from "@/lib/brand"
import {
  buildBrandedPdfDocument,
  buildStructuredCsv,
  formatExportDate,
} from "@/lib/document-export"
import type { getFinanceSummary } from "@/lib/finance-service"

type FinanceSummary = Awaited<ReturnType<typeof getFinanceSummary>>

const REPORT_COLUMNS = [
  { header: "Date", width: 68 },
  { header: "Category", width: 88 },
  { header: "Name", width: 100 },
  { header: "Description", width: 120 },
  { header: "Type", width: 52 },
  { header: "Amount", width: 72, align: "right" as const },
]

export function buildFinanceSummaryCsv(summary: FinanceSummary) {
  const brand = getBrandName()
  const stamp = formatExportDate(new Date())

  return buildStructuredCsv([
    {
      rows: [
        [brand + " — Finance Dashboard"],
        ["Report", "Finance Dashboard Overview"],
        ["Generated", stamp],
      ],
    },
    {
      title: "Overview",
      rows: [
        ["Metric", "Value"],
        ["Total Income", summary.overview.totalIncome],
        ["Income This Month", summary.overview.incomeThisMonth],
        ["Total Expenses", summary.overview.totalExpenses],
        ["Net Balance", summary.overview.netBalance],
        ["Outstanding Payables", summary.overview.outstandingPayables],
        ["Unpaid Students", summary.overview.unpaidStudents],
      ],
    },
    {
      title: "Student Fees",
      rows: [
        ["Metric", "Value"],
        ["Total Collected", summary.studentFees.totalCollected],
        ["Collected This Month", summary.studentFees.monthlyCollected],
        ["Unpaid Students", summary.studentFees.unpaidStudents],
      ],
    },
    {
      title: "Payroll & Partners",
      rows: [
        ["Section", "Monthly Due", "Balance Due", "Total Paid"],
        [
          "Teachers",
          summary.teacherPayroll.monthlyPay,
          summary.teacherPayroll.balanceDue,
          summary.teacherPayroll.totalPaidOut,
        ],
        [
          "Staff",
          summary.staffPayroll.monthlyPayroll,
          summary.staffPayroll.balanceDue,
          summary.staffPayroll.totalPaidOut,
        ],
        [
          "Partners",
          summary.partners.monthlyDue,
          summary.partners.balanceDue,
          summary.partners.totalPaidOut,
        ],
      ],
    },
    {
      title: "Revenue By Class",
      rows: [
        ["Class", "Level", "Total Collected"],
        ...summary.studentFees.byClass.map((row) => [row.className, row.classLevel ?? "", row.totalCollected]),
      ],
    },
    {
      title: "Staff Payroll Detail",
      rows: [
        ["Name", "Job Title", "Monthly Salary", "Paid Out", "Balance"],
        ...summary.staffPayroll.staff.map((row) => [
          row.name,
          row.jobTitle ?? "",
          row.monthlySalary,
          row.totalPaidOut,
          row.balanceDue,
        ]),
      ],
    },
  ])
}

export async function buildFinanceSummaryPdf(summary: FinanceSummary) {
  const brand = getBrandName()
  const stamp = formatExportDate(new Date())

  const tableRows: string[][] = [
    ...summary.studentFees.byClass.map((row) => [
      "All time",
      "Class Revenue",
      row.className,
      row.classLevel ?? "—",
      "Income",
      formatMoney(row.totalCollected),
    ]),
    ...summary.staffPayroll.staff.map((row) => [
      "Current",
      "Staff Salary",
      row.name,
      row.jobTitle ?? "—",
      "Payable",
      formatMoney(row.balanceDue),
    ]),
  ]

  return buildBrandedPdfDocument({
    title: "Finance Dashboard",
    subtitle: `${brand} · Overview as of ${stamp}`,
    summary: [
      { label: "Total Income", value: formatMoney(summary.overview.totalIncome), highlight: true },
      { label: "Income This Month", value: formatMoney(summary.overview.incomeThisMonth) },
      { label: "Other Income (manual)", value: formatMoney(summary.overview.manualIncome) },
      { label: "Total Expenses", value: formatMoney(summary.overview.totalExpenses), highlight: true },
      { label: "Net Balance", value: formatMoney(summary.overview.netBalance), highlight: true },
      { label: "Outstanding Payables", value: formatMoney(summary.overview.outstandingPayables) },
      { label: "Student Fees Collected", value: formatMoney(summary.studentFees.totalCollected) },
      { label: "Unpaid Students", value: String(summary.studentFees.unpaidStudents) },
      { label: "Teacher Payroll Due", value: formatMoney(summary.teacherPayroll.monthlyPay) },
      { label: "Staff Payroll Due", value: formatMoney(summary.staffPayroll.monthlyPayroll) },
      { label: "Partner Monthly Due", value: formatMoney(summary.partners.monthlyDue) },
    ],
    columns: REPORT_COLUMNS,
    rows: tableRows,
    emptyMessage: "No class or staff breakdown rows available.",
  })
}

export function buildFinanceReportCsv(report: {
  range: { from: string; to: string; label: string }
  filters: { category: string; entityId: string | null }
  totals: { totalIncome: number; totalExpenses: number; netBalance: number; transactionCount: number }
  lines: Array<{
    date: string
    category: string
    name: string
    description: string
    amount: number
    direction: "income" | "expense"
  }>
}) {
  const brand = getBrandName()

  return buildStructuredCsv([
    {
      title: `${brand} — Financial Report`,
      rows: [
        ["Report", "Filtered Financial Report"],
        ["Period", report.range.label],
        ["From", formatExportDate(report.range.from)],
        ["To", formatExportDate(report.range.to)],
        ["Category", report.filters.category],
        ["Generated", formatExportDate(new Date())],
      ],
    },
    {
      title: "Totals",
      rows: [
        ["Metric", "Amount"],
        ["Total Income", String(report.totals.totalIncome)],
        ["Total Expenses", String(report.totals.totalExpenses)],
        ["Net Balance", String(report.totals.netBalance)],
        ["Transactions", String(report.totals.transactionCount)],
      ],
    },
    {
      title: "Transactions",
      rows: [
        ["Date", "Category", "Name", "Description", "Type", "Amount"],
        ...report.lines.map((line) => [
          formatExportDate(line.date),
          line.category,
          line.name,
          line.description,
          line.direction,
          String(line.amount),
        ]),
      ],
    },
  ])
}

export async function buildFinanceReportPdf(report: {
  range: { from: string; to: string; label: string }
  filters: { category: string; entityId: string | null }
  totals: { totalIncome: number; totalExpenses: number; netBalance: number; transactionCount: number }
  lines: Array<{
    date: string
    category: string
    name: string
    description: string
    amount: number
    direction: "income" | "expense"
  }>
}) {
  const brand = getBrandName()

  return buildBrandedPdfDocument({
    title: "Financial Report",
    subtitle: `${brand} · ${report.range.label} (${formatExportDate(report.range.from)} – ${formatExportDate(report.range.to)}) · Category: ${report.filters.category}`,
    summary: [
      { label: "Total Income", value: formatMoney(report.totals.totalIncome), highlight: true },
      { label: "Total Expenses", value: formatMoney(report.totals.totalExpenses), highlight: true },
      { label: "Net Balance", value: formatMoney(report.totals.netBalance), highlight: true },
      { label: "Transactions", value: String(report.totals.transactionCount) },
    ],
    columns: REPORT_COLUMNS,
    rows: report.lines.map((line) => [
      formatExportDate(line.date),
      line.category,
      line.name,
      line.description || "—",
      line.direction,
      formatMoney(line.amount),
    ]),
    emptyMessage: "No transactions found for the selected filters.",
  })
}
