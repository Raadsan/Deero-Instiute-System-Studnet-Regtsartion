"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Info, Search, ArrowUpDown } from "lucide-react"

import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type TeacherClass = {
  id: string
  name: string
  courses: Array<{ id: string; name: string }>
}

type Report = {
  month: string | null
  range: { from: string; to: string; label: string }
  class: { id: string; name: string }
  teacher: string | null
  courses: Array<{ id: string; name: string }>
  students: Array<{
    id: string
    studentCode: string
    name: string
    period: number
    present: number
    absent: number
    percentage: number | null
  }>
  totals: { period: number; periods: number; present: number; absent: number; percentage: number | null }
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function currentDate() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Nairobi",
  }).format(new Date())
}

function formatReportDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function percentageColor(percentage: number | null) {
  const value = percentage ?? 0
  if (value >= 80) return "border-emerald-200 bg-emerald-100 text-emerald-800"
  if (value >= 50) return "border-amber-200 bg-amber-100 text-amber-800"
  return "border-rose-200 bg-rose-100 text-rose-800"
}

export default function TeacherAttendanceReport() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [classId, setClassId] = useState("")
  const [courseId, setCourseId] = useState("")
  const [periodMode, setPeriodMode] = useState<"month" | "range">("range")
  const [month, setMonth] = useState(currentMonth)
  const [fromDate, setFromDate] = useState(`${currentMonth()}-01`)
  const [toDate, setToDate] = useState(currentDate)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null)

  const selectedClass = useMemo(() => classes.find((item) => item.id === classId) ?? null, [classes, classId])
  const courses = selectedClass?.courses ?? []
  const selectedCourse = courses.find((item) => item.id === courseId) ?? null

  useEffect(() => {
    void api.get<TeacherClass[]>("/api/attendance/classes").then((response) => {
      setClasses(response.data)
      const firstClass = response.data[0]
      setClassId(firstClass?.id ?? "")
      setCourseId(firstClass?.courses[0]?.id ?? "")
    })
  }, [])

  const chooseClass = (value: string) => {
    setClassId(value)
    const nextClass = classes.find((item) => item.id === value)
    setCourseId(nextClass?.courses[0]?.id ?? "")
    setReport(null)
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    let filtered = (report?.students ?? []).filter(
      (item) => !query || item.name.toLowerCase().includes(query) || item.studentCode.toLowerCase().includes(query),
    )
    if (sortOrder) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a.percentage ?? 0
        const bVal = b.percentage ?? 0
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal
      })
    }
    return filtered
  }, [report, search, sortOrder])

  const generate = async () => {
    if (!classId) return
    if (periodMode === "month" && !month) return
    if (periodMode === "range" && (!fromDate || !toDate)) return
    if (periodMode === "range" && fromDate > toDate) {
      setError("From date cannot be after To date.")
      setReport(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const periodQuery =
        periodMode === "range"
          ? `from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`
          : `month=${encodeURIComponent(month)}`
      const response = await api.get<Report>(
        `/api/attendance/monthly-report?classId=${encodeURIComponent(classId)}&${periodQuery}`,
      )
      setReport(response.data)
    } catch (requestError: any) {
      setReport(null)
      setError(requestError?.response?.data?.message ?? requestError?.message ?? "Report could not be generated.")
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <Card className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-5 sm:px-7">
          <h1 className="text-2xl font-bold tracking-tight">Report Student Attendance Rate</h1>
        </div>

        <div className="space-y-8 p-5 sm:p-7">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-base font-semibold">Course</p>
              <Select value={courseId} onValueChange={setCourseId} disabled={!courses.length}>
                <SelectTrigger className="h-12 w-full rounded-lg px-4 text-base shadow-sm">
                  <SelectValue placeholder={courses.length ? "Select course" : "No course assigned"} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-base font-semibold">Class</p>
              <Select value={classId} onValueChange={chooseClass}>
                <SelectTrigger className="h-12 w-full rounded-lg px-4 text-base shadow-sm"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-base font-semibold">Report Period</p>
              <Select
                value={periodMode}
                onValueChange={(value) => {
                  setPeriodMode(value as "month" | "range")
                  setReport(null)
                }}
              >
                <SelectTrigger className="h-12 w-full rounded-lg px-4 text-base shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="range">Custom Date Range</SelectItem>
                  <SelectItem value="month">Monthly Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary p-2 text-primary-foreground">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold">{periodMode === "range" ? "Choose Date Range" : "Choose Month"}</p>
                <p className="text-xs text-muted-foreground">
                  {periodMode === "range"
                    ? "Attendance from the first selected date through the last selected date."
                    : "View the complete attendance report for one month."}
                </p>
              </div>
            </div>

            {periodMode === "range" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">From Date</p>
                  <Input
                    type="date"
                    className="!h-12 bg-background px-4"
                    value={fromDate}
                    max={toDate}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">To Date</p>
                  <Input
                    type="date"
                    className="!h-12 bg-background px-4"
                    value={toDate}
                    min={fromDate}
                    onChange={(event) => setToDate(event.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="max-w-md space-y-2">
                <p className="text-sm font-semibold">Month</p>
                <Input
                  type="month"
                  className="!h-12 bg-background px-4"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </div>
            )}
          </div>

          {loading && (
            <div className="flex justify-center py-2" role="status" aria-live="polite">
              <div className="inline-flex h-10 items-center gap-2 rounded-full border bg-muted/30 px-4 text-sm font-medium text-muted-foreground">
                <Spinner className="h-4 w-4" />
                Generating report...
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={generate} disabled={loading} className="w-full sm:w-auto h-12 px-8">
              Generate Report
            </Button>
          </div>

          <div className="flex h-12 overflow-hidden rounded-lg border bg-background">
            <div className="flex w-12 shrink-0 items-center justify-center bg-primary text-primary-foreground">
              <Info className="h-5 w-5" />
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-full w-full bg-transparent pl-11 pr-4 text-base outline-none placeholder:text-muted-foreground/60"
                placeholder="Search Information"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {report ? (
            <div className="border-t pt-8">
              <section aria-labelledby="attendance-report-heading" className="mb-8">
                <div className="mx-auto max-w-3xl text-center">
                  <h2
                    id="attendance-report-heading"
                    className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl"
                  >
                    Teacher Attendance Report
                  </h2>
                  <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">
                    {[selectedCourse?.name ?? report.courses[0]?.name ?? "Course", report.class.name, report.teacher]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-primary sm:text-base">
                    {formatReportDate(report.range.from)} – {formatReportDate(report.range.to)}
                  </p>
                </div>

                <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Card className="min-h-28 justify-between rounded-xl border-border/80 bg-background p-4 shadow-sm sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Attendance Periods</p>
                    <p className="text-2xl font-extrabold leading-none tabular-nums text-foreground sm:text-3xl">
                      {report.totals.periods}
                    </p>
                  </Card>
                  <Card className="min-h-28 justify-between rounded-xl border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/30 sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Present</p>
                    <p className="text-2xl font-extrabold leading-none tabular-nums text-emerald-800 dark:text-emerald-300 sm:text-3xl">
                      {report.totals.present}
                    </p>
                  </Card>
                  <Card className="min-h-28 justify-between rounded-xl border-orange-200 bg-orange-50/70 p-4 shadow-sm dark:border-orange-900 dark:bg-orange-950/30 sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-orange-700 dark:text-orange-400">Absent</p>
                    <p className="text-2xl font-extrabold leading-none tabular-nums text-orange-800 dark:text-orange-300 sm:text-3xl">
                      {report.totals.absent}
                    </p>
                  </Card>
                  <Card className="min-h-28 justify-between rounded-xl border-blue-200 bg-blue-50/70 p-4 shadow-sm dark:border-blue-900 dark:bg-blue-950/30 sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400">Overall Rate</p>
                    <p className="text-2xl font-extrabold leading-none tabular-nums text-blue-800 dark:text-blue-300 sm:text-3xl">
                      {report.totals.percentage ?? 0}%
                    </p>
                  </Card>
                </div>
              </section>

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="h-14 pl-6 text-base font-semibold text-foreground">ID</TableHead>
                      <TableHead className="text-base font-semibold text-foreground">Name</TableHead>
                      <TableHead className="text-center text-base font-semibold text-foreground">Period</TableHead>
                      <TableHead className="text-center text-base font-semibold text-foreground">Present</TableHead>
                      <TableHead className="text-center text-base font-semibold text-foreground">Absent</TableHead>
                      <TableHead 
                        className="pr-6 text-right text-base font-semibold text-foreground cursor-pointer hover:bg-muted/50 select-none transition-colors"
                        onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : prev === "desc" ? null : "asc")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Percentage
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((item) => (
                      <TableRow key={item.id} className="h-16">
                        <TableCell className="pl-6 font-mono text-sm">{item.studentCode}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{item.name}</TableCell>
                        <TableCell className="text-center tabular-nums">{item.period}</TableCell>
                        <TableCell className="text-center tabular-nums">{item.present}</TableCell>
                        <TableCell className="text-center tabular-nums">{item.absent}</TableCell>
                        <TableCell className="pr-6 text-right font-semibold tabular-nums">
                          <Badge variant="outline" className={`min-w-16 justify-center ${percentageColor(item.percentage)}`}>
                            {`${item.percentage ?? 0}%`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!rows.length && (
                      <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No attendance information found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Select a class and report period. The report will appear automatically.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
