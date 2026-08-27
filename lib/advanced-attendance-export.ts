import * as XLSX from "xlsx"

import type { AdvancedAttendanceReport } from "@/lib/advanced-attendance-report"
import { buildBrandedPdfDocument } from "@/lib/document-export"
import { getBrandName } from "@/lib/brand"

function rate(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(1)}%`
}

function setWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet["!cols"] = widths.map((wch) => ({ wch }))
}

export function buildAdvancedAttendanceWorkbook(report: AdvancedAttendanceReport) {
  const workbook = XLSX.utils.book_new()

  const summarySheet = XLSX.utils.aoa_to_sheet([
    [`${getBrandName()} - Advanced Attendance Report`],
    ["Month", report.range.label],
    ["Low attendance threshold", `${report.threshold}%`],
    [],
    ["Metric", "Value"],
    ["Overall attendance rate", rate(report.summary.attendanceRate)],
    ["Teaching periods", report.summary.teachingPeriods],
    ["Teachers reporting", report.summary.teachersReporting],
    ["Classes reporting", report.summary.classesReporting],
    ["Students evaluated", report.summary.studentsEvaluated],
    ["Low attendance students", report.summary.lowAttendanceStudents],
    ["Present", report.summary.present],
    ["Late", report.summary.late],
    ["Absent", report.summary.absent],
    ["Excused", report.summary.excused],
    ["Leave", report.summary.leave],
  ])
  setWidths(summarySheet, [30, 24])
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary")

  const teacherSheet = XLSX.utils.json_to_sheet(
    report.teacherPerformance.map((row) => ({
      Teacher: row.teacherName,
      Email: row.teacherEmail,
      Classes: row.classes.join(", "),
      "Teaching Periods": row.teachingPeriods,
      Present: row.present,
      Late: row.late,
      Absent: row.absent,
      Excused: row.excused,
      Leave: row.leave,
      "Attendance Rate": rate(row.attendanceRate),
      Performance: row.performance.replaceAll("_", " "),
    })),
  )
  setWidths(teacherSheet, [25, 30, 38, 18, 12, 10, 10, 10, 10, 18, 20])
  XLSX.utils.book_append_sheet(workbook, teacherSheet, "Teachers")

  const classSheet = XLSX.utils.json_to_sheet(
    report.classComparison.map((row) => ({
      Class: row.className,
      Teacher: row.teacherName ?? "Unassigned",
      Students: row.studentCount,
      "Teaching Periods": row.teachingPeriods,
      Present: row.present,
      Late: row.late,
      Absent: row.absent,
      Excused: row.excused,
      Leave: row.leave,
      "Attendance Rate": rate(row.attendanceRate),
    })),
  )
  setWidths(classSheet, [28, 25, 12, 18, 12, 10, 10, 10, 10, 18])
  XLSX.utils.book_append_sheet(workbook, classSheet, "Classes")

  const studentSheet = XLSX.utils.json_to_sheet(
    report.lowAttendanceStudents.map((row) => ({
      Code: row.studentCode ?? "",
      Student: row.studentName,
      Class: row.className ?? "Unassigned",
      Phone: row.phone ?? "",
      Present: row.present,
      Late: row.late,
      Absent: row.absent,
      "Eligible Periods": row.eligiblePeriods,
      "Attendance Rate": rate(row.attendanceRate),
    })),
  )
  setWidths(studentSheet, [16, 28, 28, 18, 12, 10, 10, 18, 18])
  XLSX.utils.book_append_sheet(workbook, studentSheet, "Low Attendance")

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}

export function buildAdvancedAttendancePdf(report: AdvancedAttendanceReport) {
  const rows: string[][] = [
    ...report.teacherPerformance.map((row) => [
      "Teacher",
      row.teacherName,
      row.classes.join(", ") || "No assigned class",
      String(row.teachingPeriods),
      String(row.absent),
      rate(row.attendanceRate),
    ]),
    ...report.classComparison.map((row) => [
      "Class",
      row.className,
      row.teacherName ?? "Unassigned",
      String(row.teachingPeriods),
      String(row.absent),
      rate(row.attendanceRate),
    ]),
    ...report.lowAttendanceStudents.map((row) => [
      "Low student",
      row.studentName,
      row.className ?? "Unassigned",
      String(row.eligiblePeriods),
      String(row.absent),
      rate(row.attendanceRate),
    ]),
  ]

  return buildBrandedPdfDocument({
    title: "Advanced Attendance Report",
    subtitle: `${report.range.label} - Students below ${report.threshold}% are flagged`,
    summary: [
      { label: "Overall attendance rate", value: rate(report.summary.attendanceRate), highlight: true },
      { label: "Teaching periods", value: String(report.summary.teachingPeriods) },
      { label: "Teachers reporting", value: String(report.summary.teachersReporting) },
      { label: "Classes reporting", value: String(report.summary.classesReporting) },
      { label: "Students evaluated", value: String(report.summary.studentsEvaluated) },
      { label: "Low attendance students", value: String(report.summary.lowAttendanceStudents), highlight: true },
      { label: "Present / Late", value: `${report.summary.present} / ${report.summary.late}` },
      { label: "Absent", value: String(report.summary.absent), highlight: true },
    ],
    columns: [
      { header: "Section", width: 70 },
      { header: "Name", width: 120 },
      { header: "Class / Teacher", width: 145 },
      { header: "Periods", width: 55, align: "right" },
      { header: "Absent", width: 55, align: "right" },
      { header: "Rate", width: 55, align: "right" },
    ],
    rows,
    emptyMessage: "No attendance records found for this month.",
  })
}
