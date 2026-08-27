"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Users, CalendarCheck, FileBarChart, Search, FileText } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ATTENDANCE_STATUS_OPTIONS, type AttendanceStatus } from "@/lib/attendance-status"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ClassOption = { id: string; name: string; level: string | null; isActive: boolean }

type AttendanceSummaryRow = {
  class: { id: string; name: string; level: string | null }
  presentCount: number
  absentCount: number
  lateCount: number
  excusedCount: number
  leaveCount: number
  total: number
  unmarkedCount: number
  percentage: number
  teachers: Array<{ id: string; name: string; email: string }>
}

type AttendanceSummaryResponse = { date: string; data: AttendanceSummaryRow[] }

type AttendanceRecordRow = {
  id: string
  class: { id: string; name: string; level: string | null }
  status: AttendanceStatus | "NOT_MARKED"
  note: string | null
  student: {
    id: string
    studentCode: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    gender?: string | null
    attendancePercentage?: number | null
  } | null
  teacher: { id: string; name: string; email: string } | null
  createdAt: string | null
}

type AttendanceRecordsResponse = {
  date: string
  class: { id: string; name: string; level: string | null } | null
  latestDate: string | null
  total: number
  rosterTotal: number
  data: AttendanceRecordRow[]
}

type MonthlyReportResponse = {
  month: string
  class: { id: string; name: string; level: string | null }
  teacher: string | null
  courses: Array<{ id: string; name: string }>
  students: Array<{
    id: string
    studentCode: string
    name: string
    period: number
    present: number
    absent: number
    late: number
    excused: number
    leave: number
    percentage: number | null
  }>
  totals: {
    period: number
    periods: number
    present: number
    absent: number
    late: number
    excused: number
    leave: number
    percentage: number | null
  }
}

const ALL_CLASS_VALUE = "__all__"
const selectContentClass = "z-[200] bg-background border shadow-xl"

function formatDateInputValue(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function formatPersonName(firstName: string, lastName: string) {
  const format = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  return `${format(firstName)} ${format(lastName)}`.trim()
}

function statusLabel(status: AttendanceRecordRow["status"]) {
  return ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "Not marked"
}

function statusBadgeClass(status: AttendanceRecordRow["status"]) {
  if (status === "PRESENT") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "ABSENT") return "border-rose-200 bg-rose-50 text-rose-700"
  if (status === "LATE") return "border-amber-200 bg-amber-50 text-amber-700"
  if (status === "EXCUSED") return "border-sky-200 bg-sky-50 text-sky-700"
  if (status === "LEAVE") return "border-violet-200 bg-violet-50 text-violet-700"
  return "border-slate-200 bg-slate-50 text-slate-600"
}

export default function AttendanceView() {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [date, setDate] = useState<string>(() => formatDateInputValue(new Date()))

  const [summary, setSummary] = useState<AttendanceSummaryResponse | null>(null)
  const [records, setRecords] = useState<AttendanceRecordsResponse | null>(null)
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState<"daily" | "monthly">("daily")
  const [reportMonth, setReportMonth] = useState(() => formatDateInputValue(new Date()).slice(0, 7))
  const [reportSearch, setReportSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [genderFilter, setGenderFilter] = useState<string>("ALL")
  const [selectedExcuse, setSelectedExcuse] = useState<AttendanceRecordRow | null>(null)

  useEffect(() => {
    setStatusFilter("ALL")
    setGenderFilter("ALL")
  }, [selectedClassId])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const res = await api.get<ClassOption[]>("/api/classes")
        setClasses(res.data)
        if (res.data.length) setSelectedClassId((cur) => cur || ALL_CLASS_VALUE)
      } catch (e: any) {
        toast({ title: "Failed to load classes", description: getErrorMessage(e), variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const loadSummary = async () => {
    try {
      const effectiveClassId = selectedClassId && selectedClassId !== ALL_CLASS_VALUE ? selectedClassId : null
      const url = effectiveClassId
        ? `/api/attendance/summary?date=${encodeURIComponent(date)}&classId=${encodeURIComponent(selectedClassId)}`
        : `/api/attendance/summary?date=${encodeURIComponent(date)}`
      const res = await api.get<AttendanceSummaryResponse>(url)
      setSummary(res.data)
    } catch (e: any) {
      toast({ title: "Failed to load attendance summary", description: getErrorMessage(e), variant: "destructive" })
      setSummary(null)
    }
  }

  const loadRecords = async () => {
    if (!selectedClassId) {
      setRecords(null)
      return
    }
    setLoadingRecords(true)
    try {
      const classQuery = selectedClassId === ALL_CLASS_VALUE ? "" : `&classId=${encodeURIComponent(selectedClassId)}`
      const res = await api.get<AttendanceRecordsResponse>(
        `/api/attendance/records?date=${encodeURIComponent(date)}${classQuery}&limit=1000`,
      )
      setRecords(res.data)
      if (res.data.total === 0 && res.data.latestDate && res.data.latestDate !== date) {
        setDate(res.data.latestDate)
        toast({
          title: "Showing latest attendance",
          description: `No attendance was recorded on ${date}. Showing ${res.data.latestDate} instead.`,
        })
      }
    } catch (e: any) {
      toast({ title: "Failed to load records", description: getErrorMessage(e), variant: "destructive" })
      setRecords(null)
    } finally {
      setLoadingRecords(false)
    }
  }

  const loadMonthlyReport = async () => {
    if (!selectedClassId || selectedClassId === ALL_CLASS_VALUE) {
      setMonthlyReport(null)
      return
    }
    setLoadingHistory(true)
    try {
      const res = await api.get<MonthlyReportResponse>(
        `/api/attendance/monthly-report?classId=${encodeURIComponent(selectedClassId)}&month=${encodeURIComponent(reportMonth)}`,
      )
      setMonthlyReport(res.data)
    } catch (e: any) {
      toast({ title: "Failed to generate monthly report", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (!date) return
    void loadSummary()
    void loadRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedClassId, activeTab])

  const filteredMonthlyStudents = useMemo(() => {
    const query = reportSearch.trim().toLowerCase()
    if (!query) return monthlyReport?.students ?? []
    return (monthlyReport?.students ?? []).filter(
      (student) => student.name.toLowerCase().includes(query) || student.studentCode.toLowerCase().includes(query),
    )
  }, [monthlyReport, reportSearch])

  const summaryRows = useMemo(() => summary?.data ?? [], [summary])
  const selectedClass = useMemo(
    () => (selectedClassId && selectedClassId !== ALL_CLASS_VALUE ? classes.find((c) => c.id === selectedClassId) ?? null : null),
    [classes, selectedClassId],
  )

  const dayTotals = useMemo(() => {
    return summaryRows.reduce(
      (acc, row) => ({
        present: acc.present + row.presentCount,
        absent: acc.absent + row.absentCount,
        late: acc.late + row.lateCount,
        excused: acc.excused + row.excusedCount,
        leave: acc.leave + row.leaveCount,
      }),
      { present: 0, absent: 0, late: 0, excused: 0, leave: 0 },
    )
  }, [summaryRows])

  const dayRate = useMemo(() => {
    const attended = dayTotals.present + dayTotals.late
    const total = attended + dayTotals.absent
    return total > 0 ? Math.round((attended / total) * 100) : 0
  }, [dayTotals])

  const filteredRecords = useMemo(() => {
    if (!records?.data) return []
    return records.data.filter((r) => {
      // Status Filter
      if (statusFilter !== "ALL" && statusFilter !== "NOT_MARKED" && r.status !== statusFilter) return false
      if (statusFilter === "NOT_MARKED" && r.status !== "NOT_MARKED") return false
      
      // Gender Filter
      const gender = (r.student?.gender || "UNKNOWN").toUpperCase()
      if (genderFilter === "MALE" && gender !== "MALE") return false
      if (genderFilter === "FEMALE" && gender !== "FEMALE") return false
      
      return true
    })
  }, [records, statusFilter, genderFilter])

  const downloadCsv = async () => {
    if (!selectedClassId) return
    setDownloading(true)
    try {
      const data =
        records && records.date === date &&
          (selectedClassId === ALL_CLASS_VALUE ? records.class === null : records.class?.id === selectedClassId)
          ? records
          : (await api.get<AttendanceRecordsResponse>(
            `/api/attendance/records?date=${encodeURIComponent(date)}${selectedClassId === ALL_CLASS_VALUE ? "" : `&classId=${encodeURIComponent(selectedClassId)}`}&limit=1000`,
          )).data
      const lines = [
        ["Date", "Class", "Student ID", "Student", "Gender", "Status", "Teacher", "Note", "Created At"].join(","),
        ...data.data.map((r) => {
          const studentName = r.student ? `${r.student.firstName} ${r.student.lastName}`.trim() : ""
          const teacherName = r.teacher ? r.teacher.name : ""
          const createdAt = r.createdAt ? new Date(r.createdAt).toISOString() : ""
          return [
            data.date,
            `"${r.class.name.replace(/"/g, '""')}"`,
            `"${(r.student?.studentCode ?? "").replace(/"/g, '""')}"`,
            `"${studentName.replace(/"/g, '""')}"`,
            `"${(r.student?.gender ?? "").replace(/"/g, '""')}"`,
            r.status,
            `"${teacherName.replace(/"/g, '""')}"`,
            `"${(r.note ?? "").replace(/"/g, '""')}"`,
            createdAt,
          ].join(",")
        }),
      ].join("\n")

      const blob = new Blob([lines], { type: "text/csv;charset=utf-8" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `attendance-${data.class?.name ?? "all-classes"}-${data.date}.csv`.replace(/\s+/g, "-").toLowerCase()
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      toast({ title: "Download failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#003D9E]/10 via-background to-[#EC4724]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#003D9E]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/15 px-3 py-1 text-xs font-medium text-primary">
                <CalendarCheck className="w-3.5 h-3.5" />
                {dayRate}% attendance today
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
                {dayTotals.present + dayTotals.late} attended
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700">
                {dayTotals.absent} absent
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {dayTotals.excused + dayTotals.leave} approved away
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Attendance Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              View daily attendance by class, export records, and track 30-day history.
            </p>
          </div>
          <Button
            className="w-full lg:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6 shrink-0"
            onClick={downloadCsv}
            disabled={!selectedClassId || downloading || loading || loadingRecords}
          >
            <Download className="w-4 h-4" /> {downloading ? "Preparing..." : "Export CSV"}
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-5 border-muted/50 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Class</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={loading}>
              <SelectTrigger className="h-11 w-full rounded-lg bg-background border-muted shadow-sm">
                <SelectValue placeholder={loading ? "Loading..." : "Select a class"} />
              </SelectTrigger>
              <SelectContent className={selectContentClass} position="popper">
                <SelectItem value={ALL_CLASS_VALUE}>All classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="attendanceDate" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</Label>
            <Input
              id="attendanceDate"
              type="date"
              className="h-11 rounded-lg bg-background border-muted shadow-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <div className="inline-flex gap-1 p-1 bg-muted/40 rounded-full border border-muted/60">
        <Button
          variant={activeTab === "daily" ? "default" : "ghost"}
          className="rounded-full px-5 gap-2"
          onClick={() => setActiveTab("daily")}
        >
          <CalendarCheck className="w-4 h-4" />
          Daily
        </Button>
        <Button
          variant={activeTab === "monthly" ? "default" : "ghost"}
          className="rounded-full px-5 gap-2"
          onClick={() => setActiveTab("monthly")}
        >
          <FileBarChart className="w-4 h-4" />
          Monthly Report
        </Button>
      </div>

      {activeTab === "daily" ? (
        <>
          {loading ? (
            <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
              <Spinner className="w-8 h-8 text-primary" />
              <p>Loading summary...</p>
            </Card>
          ) : summaryRows.length === 0 ? (
            <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
              <div className="p-4 rounded-full bg-muted">
                <Download className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-lg font-medium">No attendance found</p>
              <p className="text-sm">Try selecting a different date or class.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summaryRows.map((row) => (
                <Card key={row.class.id} className="relative p-5 sm:p-6 transition-all hover:shadow-md border-muted/50 shadow-sm overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#003D9E] to-[#EC4724] opacity-80" />
                  <div className="flex items-start justify-between mb-5 gap-4 pt-1">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-lg font-bold text-foreground truncate tracking-tight capitalize">{row.class.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {row.class.level ? `Level ${row.class.level}` : "No level"}
                        {row.teachers.length ? ` · ${row.teachers[0].name}` : ""}
                      </p>
                    </div>
                    <div
                      className={`text-xl font-bold tabular-nums shrink-0 ${
                        row.percentage >= 90 ? "text-emerald-600" : row.percentage >= 70 ? "text-[#003D9E]" : "text-amber-600"
                      }`}
                    >
                      {row.percentage}%
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 py-2.5 px-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Attended</p>
                      <p className="text-lg font-bold text-emerald-800 tabular-nums">{row.presentCount + row.lateCount}</p>
                    </div>
                    <div className="rounded-xl bg-rose-50 border border-rose-100 py-2.5 px-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Absent</p>
                      <p className="text-lg font-bold text-rose-800 tabular-nums">{row.absentCount}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 border border-muted py-2.5 px-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                      <p className="text-lg font-bold text-foreground tabular-nums">{row.total}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground">
                    <span className="text-amber-700">{row.lateCount} late</span>
                    <span className="text-sky-700">{row.excusedCount} excused</span>
                    <span className="text-violet-700">{row.leaveCount} leave</span>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Student Records
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground capitalize">
                      {selectedClass ? selectedClass.name : selectedClassId === ALL_CLASS_VALUE ? "All classes" : "Select a class"}
                    </span>
                    <span className="mx-2">·</span>
                    <span>{date}</span>
                  </div>
                </div>
                {loadingRecords ? (
                  <Badge variant="outline" className="w-fit gap-2 py-1.5 rounded-full">
                    <Spinner className="w-3 h-3" /> Loading...
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="w-fit rounded-full font-medium tabular-nums">
                    {filteredRecords.length} records
                  </Badge>
                )}
              </div>
              {/* Filters for Daily View */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 mt-4 border-t border-muted/50">
                 <div className="space-y-2">
                   <p className="text-sm font-medium">Filter by Status</p>
                   <Select value={statusFilter} onValueChange={setStatusFilter}>
                     <SelectTrigger className="h-10 bg-background">
                       <SelectValue placeholder="All Statuses" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="ALL">All Statuses</SelectItem>
                        {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                       <SelectItem value="NOT_MARKED">Not Marked</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 
                 <div className="space-y-2">
                   <p className="text-sm font-medium">Filter by Gender</p>
                   <Select value={genderFilter} onValueChange={setGenderFilter}>
                     <SelectTrigger className="h-10 bg-background">
                       <SelectValue placeholder="All Genders" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="ALL">All Genders</SelectItem>
                       <SelectItem value="MALE">Male</SelectItem>
                       <SelectItem value="FEMALE">Female</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
              </div>
            </div>

            {loadingRecords ? (
              <div className="p-12 flex justify-center text-muted-foreground"><Spinner /></div>
            ) : !records || records.data.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm border-dashed">No records available for this selection.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Student</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Class</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center w-[110px]">Status</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[240px]">Excuse / Reason</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Teacher</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell text-right pr-6">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0">
                        <TableCell className="py-4 pl-6 align-middle">
                          <div className="space-y-0.5">
                            <div className="text-base text-foreground font-semibold line-clamp-1">
                              {r.student ? formatPersonName(r.student.firstName, r.student.lastName) : "—"}
                            </div>
                            <div className="text-xs text-muted-foreground md:hidden truncate flex items-center gap-1.5 pt-1">
                              <span>{r.teacher?.name ?? "—"}</span>
                              <span>·</span>
                              <span className="font-mono text-[10px]">
                                {r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                              </span>
                            </div>
                            <div className="flex gap-2 items-center mt-1">
                              {r.student?.gender && <Badge variant="outline" className="text-[10px]">{r.student.gender}</Badge>}
                              {r.student?.attendancePercentage != null && (
                                <Badge variant="outline" className={`text-[10px] border-transparent ${r.student.attendancePercentage >= 80 ? "bg-emerald-100 text-emerald-800" : r.student.attendancePercentage >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}>
                                  {r.student.attendancePercentage}% att
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-sm font-medium text-foreground">{r.class.name}</TableCell>
                        <TableCell className="py-4 align-middle text-center">
                          <Badge
                            variant="secondary"
                            className={`inline-flex min-w-[80px] justify-center rounded-full border px-3 py-1 text-xs font-semibold shadow-none ${statusBadgeClass(r.status)}`}
                          >
                            {statusLabel(r.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          {r.status !== "PRESENT" && r.status !== "NOT_MARKED" ? (
                            r.note?.trim() ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5"
                                onClick={() => setSelectedExcuse(r)}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                View note
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">No note provided</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-4 text-sm text-foreground/80 align-middle">{r.teacher?.name ?? "—"}</TableCell>
                        <TableCell className="hidden md:table-cell py-4 text-sm text-muted-foreground text-right pr-6 font-mono">
                          {r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filteredRecords.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No students match the selected filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6 border-muted/50 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold tracking-tight">Student Attendance Rate Report</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose a class and month, then generate a clear report for the teacher.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportMonth">Month</Label>
                <Input id="reportMonth" type="month" className="h-11" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} />
              </div>
              <Button className="h-11 gap-2" disabled={!selectedClassId || selectedClassId === ALL_CLASS_VALUE || !reportMonth || loadingHistory} onClick={() => void loadMonthlyReport()}>
                {loadingHistory ? <Spinner className="w-4 h-4" /> : <FileBarChart className="w-4 h-4" />}
                Generate Report
              </Button>
            </div>
          </Card>

          {monthlyReport && (
            <Card className="rounded-xl border-muted/50 shadow-sm overflow-hidden">
              <div className="p-5 sm:p-6 border-b bg-muted/20 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold">Report Student Attendance Rate</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {monthlyReport.courses.map((course) => course.name).join(", ") || "No course"} · {monthlyReport.class.name} · {new Date(`${monthlyReport.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                    </p>
                    {monthlyReport.teacher && <p className="text-xs text-muted-foreground mt-1">Teacher: {monthlyReport.teacher}</p>}
                  </div>
                  <Badge variant="outline" className="w-fit py-2 px-3 text-sm">
                    Overall: {monthlyReport.totals.percentage == null ? "No records" : `${monthlyReport.totals.percentage}%`}
                  </Badge>
                </div>
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9 bg-background" placeholder="Search student name or ID..." value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="pl-6">ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Period</TableHead>
                      <TableHead className="text-center">Present</TableHead>
                      <TableHead className="text-center">Late</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-center">Excused</TableHead>
                      <TableHead className="text-center">Leave</TableHead>
                      <TableHead className="text-right pr-6">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMonthlyStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="pl-6 font-mono text-xs text-muted-foreground">{student.studentCode}</TableCell>
                        <TableCell className="font-semibold">{student.name}</TableCell>
                        <TableCell className="text-center tabular-nums">{student.period}</TableCell>
                        <TableCell className="text-center font-semibold text-emerald-700 tabular-nums">{student.present}</TableCell>
                        <TableCell className="text-center font-semibold text-amber-700 tabular-nums">{student.late}</TableCell>
                        <TableCell className="text-center font-semibold text-rose-700 tabular-nums">{student.absent}</TableCell>
                        <TableCell className="text-center font-semibold text-sky-700 tabular-nums">{student.excused}</TableCell>
                        <TableCell className="text-center font-semibold text-violet-700 tabular-nums">{student.leave}</TableCell>
                        <TableCell className="text-right pr-6">
                          <Badge variant="outline" className={student.percentage == null ? "text-muted-foreground" : student.percentage >= 80 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                            {student.percentage == null ? "No records" : `${student.percentage}%`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filteredMonthlyStudents.length && (
                      <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No students found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}

      <Dialog open={Boolean(selectedExcuse)} onOpenChange={(open) => !open && setSelectedExcuse(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <FileText className="h-5 w-5" />
            </div>
            <DialogTitle>Attendance Note</DialogTitle>
            <DialogDescription>
              The note or reason submitted by the teacher for this attendance status.
            </DialogDescription>
          </DialogHeader>

          {selectedExcuse && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Student</p>
                  <p className="mt-1 font-semibold">
                    {selectedExcuse.student
                      ? formatPersonName(selectedExcuse.student.firstName, selectedExcuse.student.lastName)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Class</p>
                  <p className="mt-1 font-semibold">{selectedExcuse.class.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Teacher</p>
                  <p className="mt-1 font-semibold">{selectedExcuse.teacher?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</p>
                  <p className="mt-1 font-semibold">{date}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                  <Badge variant="outline" className={`mt-1 ${statusBadgeClass(selectedExcuse.status)}`}>
                    {statusLabel(selectedExcuse.status)}
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Teacher&apos;s note / reason</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-foreground">
                  {selectedExcuse.note}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
