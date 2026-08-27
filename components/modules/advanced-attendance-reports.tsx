"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  Award,
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  GraduationCap,
  RefreshCw,
  School,
  Users,
} from "lucide-react"

import type { AdvancedAttendanceReport, AttendanceMetrics } from "@/lib/advanced-attendance-report"
import { api } from "@/lib/api"
import { downloadExportFile } from "@/lib/export-client"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function currentMonth() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
}

function getErrorMessage(error: unknown) {
  const err = error as { response?: { data?: { message?: string } }; message?: string }
  return err.response?.data?.message ?? err.message ?? "Something went wrong."
}

function formatRate(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(1)}%`
}

function rateClass(value: number | null) {
  if (value === null) return "bg-slate-100 text-slate-600 border-slate-200"
  if (value >= 90) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value >= 75) return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-rose-50 text-rose-700 border-rose-200"
}

function performanceLabel(value: AdvancedAttendanceReport["teacherPerformance"][number]["performance"]) {
  if (value === "EXCELLENT") return "Excellent"
  if (value === "GOOD") return "Good"
  if (value === "NEEDS_ATTENTION") return "Needs attention"
  return "No data"
}

function StatusBreakdown({ metrics }: { metrics: AttendanceMetrics }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span><strong className="text-emerald-700">{metrics.present}</strong> present</span>
      <span><strong className="text-amber-700">{metrics.late}</strong> late</span>
      <span><strong className="text-rose-700">{metrics.absent}</strong> absent</span>
    </div>
  )
}

function ReportMetric({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
}: {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
}) {
  return (
    <Card className="border-muted/60 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

function EmptyRows({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-28 text-center text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  )
}

export default function AdvancedAttendanceReports() {
  const [report, setReport] = useState<AdvancedAttendanceReport | null>(null)
  const [month, setMonth] = useState(currentMonth)
  const [threshold, setThreshold] = useState("75")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null)

  const query = useCallback(() => {
    const params = new URLSearchParams({ month, threshold })
    return params.toString()
  }, [month, threshold])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<AdvancedAttendanceReport>(`/api/reports/attendance-advanced?${query()}`)
      setReport(response.data)
    } catch (fetchError) {
      setError(getErrorMessage(fetchError))
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  const handleExport = async (format: "excel" | "pdf") => {
    setExporting(format)
    try {
      const extension = format === "excel" ? "xlsx" : "pdf"
      await downloadExportFile(
        `/api/reports/attendance-advanced/export?format=${format}&${query()}`,
        `advanced-attendance-${month}.${extension}`,
      )
      toast({ title: format === "excel" ? "Excel report downloaded" : "PDF report downloaded" })
    } catch (exportError) {
      toast({ title: "Export failed", description: getErrorMessage(exportError), variant: "destructive" })
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/15 shadow-sm">
        <div className="bg-gradient-to-br from-[#003D9E]/10 via-background to-[#EC4724]/5 p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit rounded-full bg-background/80 text-primary">
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                Advanced Reports
              </Badge>
              <div>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Advanced Attendance Reports</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Monthly teacher performance, class comparison, and students who need attendance follow-up.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2 bg-background/80"
                onClick={() => void handleExport("pdf")}
                disabled={loading || exporting !== null || !report}
              >
                <Download className="h-4 w-4" />
                {exporting === "pdf" ? "Preparing..." : "Export PDF"}
              </Button>
              <Button
                className="gap-2"
                onClick={() => void handleExport("excel")}
                disabled={loading || exporting !== null || !report}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {exporting === "excel" ? "Preparing..." : "Export Excel"}
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t bg-muted/10 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,260px)_minmax(180px,260px)_auto] lg:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="advanced-report-month">Report month</Label>
              <Input
                id="advanced-report-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attendance-threshold">Low attendance threshold</Label>
              <select
                id="attendance-threshold"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="60">Below 60%</option>
                <option value="70">Below 70%</option>
                <option value="75">Below 75%</option>
                <option value="80">Below 80%</option>
                <option value="90">Below 90%</option>
              </select>
            </div>
            <Button variant="outline" className="gap-2 sm:col-span-2 lg:col-span-1" onClick={() => void fetchReport()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh report
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="flex min-h-64 flex-col items-center justify-center gap-3 border-dashed text-muted-foreground">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm">Calculating advanced attendance report...</p>
        </Card>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</div>
        </Card>
      ) : report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ReportMetric
              label="Overall Rate"
              value={formatRate(report.summary.attendanceRate)}
              hint={`${report.summary.attended} attended of ${report.summary.eligiblePeriods} eligible records`}
              icon={Award}
              iconClass="bg-emerald-100 text-emerald-700"
            />
            <ReportMetric
              label="Teaching Periods"
              value={report.summary.teachingPeriods.toLocaleString()}
              hint={`${report.summary.classesReporting} classes reported in ${report.range.label}`}
              icon={CalendarDays}
              iconClass="bg-blue-100 text-blue-700"
            />
            <ReportMetric
              label="Teachers Reporting"
              value={report.summary.teachersReporting.toLocaleString()}
              hint="Teachers with recorded class attendance"
              icon={GraduationCap}
              iconClass="bg-violet-100 text-violet-700"
            />
            <ReportMetric
              label="Low Attendance"
              value={report.summary.lowAttendanceStudents.toLocaleString()}
              hint={`Students below ${report.threshold}% attendance`}
              icon={AlertTriangle}
              iconClass="bg-rose-100 text-rose-700"
            />
          </div>

          <Tabs defaultValue="teachers" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap gap-1 p-1">
              <TabsTrigger value="teachers" className="gap-2"><GraduationCap className="h-4 w-4" />Teachers</TabsTrigger>
              <TabsTrigger value="classes" className="gap-2"><School className="h-4 w-4" />Class Comparison</TabsTrigger>
              <TabsTrigger value="students" className="gap-2"><Users className="h-4 w-4" />Low Attendance</TabsTrigger>
            </TabsList>

            <TabsContent value="teachers">
              <Card className="overflow-hidden border-muted/60">
                <div className="border-b px-5 py-4">
                  <h3 className="font-semibold">Monthly Teacher Performance</h3>
                  <p className="text-sm text-muted-foreground">Class attendance results recorded under each teacher for {report.range.label}.</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Classes</TableHead>
                        <TableHead className="text-center">Periods</TableHead>
                        <TableHead>Attendance Records</TableHead>
                        <TableHead className="min-w-44">Rate</TableHead>
                        <TableHead>Performance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.teacherPerformance.length === 0 ? (
                        <EmptyRows colSpan={6} message="No teachers or attendance records found for this month." />
                      ) : report.teacherPerformance.map((row) => (
                        <TableRow key={row.teacherId}>
                          <TableCell>
                            <p className="font-medium">{row.teacherName}</p>
                            <p className="text-xs text-muted-foreground">{row.teacherEmail}</p>
                          </TableCell>
                          <TableCell className="max-w-64 text-sm">{row.classes.join(", ") || "No assigned class"}</TableCell>
                          <TableCell className="text-center font-medium tabular-nums">{row.teachingPeriods}</TableCell>
                          <TableCell><StatusBreakdown metrics={row} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Progress value={row.attendanceRate ?? 0} className="h-2 min-w-24" />
                              <span className="w-14 text-right text-sm font-semibold tabular-nums">{formatRate(row.attendanceRate)}</span>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className={rateClass(row.attendanceRate)}>{performanceLabel(row.performance)}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="classes">
              <Card className="overflow-hidden border-muted/60">
                <div className="border-b px-5 py-4">
                  <h3 className="font-semibold">Class Attendance Comparison</h3>
                  <p className="text-sm text-muted-foreground">Compare class rates, teaching periods, and attendance status totals.</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead className="text-center">Students</TableHead>
                        <TableHead className="text-center">Periods</TableHead>
                        <TableHead>Attendance Records</TableHead>
                        <TableHead className="min-w-48">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.classComparison.length === 0 ? (
                        <EmptyRows colSpan={6} message="No classes found for this month." />
                      ) : report.classComparison.map((row) => (
                        <TableRow key={row.classId}>
                          <TableCell className="font-medium">{row.className}</TableCell>
                          <TableCell>{row.teacherName ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                          <TableCell className="text-center tabular-nums">{row.studentCount}</TableCell>
                          <TableCell className="text-center font-medium tabular-nums">{row.teachingPeriods}</TableCell>
                          <TableCell><StatusBreakdown metrics={row} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Progress value={row.attendanceRate ?? 0} className="h-2 min-w-28" />
                              <Badge variant="outline" className={`${rateClass(row.attendanceRate)} w-16 justify-center`}>{formatRate(row.attendanceRate)}</Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="students">
              <Card className="overflow-hidden border-muted/60">
                <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold">Students With Low Attendance</h3>
                    <p className="text-sm text-muted-foreground">Only students below {report.threshold}% during {report.range.label}.</p>
                  </div>
                  <Badge variant="outline" className="w-fit border-rose-200 bg-rose-50 text-rose-700">
                    {report.lowAttendanceStudents.length} need follow-up
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-center">Attended</TableHead>
                        <TableHead className="text-center">Absent</TableHead>
                        <TableHead className="text-center">Total Periods</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.lowAttendanceStudents.length === 0 ? (
                        <EmptyRows colSpan={7} message={`No students are below ${report.threshold}% for this month.`} />
                      ) : report.lowAttendanceStudents.map((row) => (
                        <TableRow key={row.studentId}>
                          <TableCell>
                            <p className="font-medium">{row.studentName}</p>
                            <p className="text-xs text-muted-foreground">{row.studentCode ?? "No student code"}</p>
                          </TableCell>
                          <TableCell>{row.className ?? "Unassigned"}</TableCell>
                          <TableCell>{row.phone ?? <span className="text-muted-foreground">No phone</span>}</TableCell>
                          <TableCell className="text-center font-medium text-emerald-700 tabular-nums">{row.attended}</TableCell>
                          <TableCell className="text-center font-medium text-rose-700 tabular-nums">{row.absent}</TableCell>
                          <TableCell className="text-center tabular-nums">{row.eligiblePeriods}</TableCell>
                          <TableCell className="text-right"><Badge variant="outline" className={rateClass(row.attendanceRate)}>{formatRate(row.attendanceRate)}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  )
}
