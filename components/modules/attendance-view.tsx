"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Users, CalendarCheck, History } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ClassOption = { id: string; name: string; level: string | null; isActive: boolean }

type AttendanceSummaryRow = {
  class: { id: string; name: string; level: string | null }
  presentCount: number
  absentCount: number
  total: number
  percentage: number
  teachers: Array<{ id: string; name: string; email: string }>
}

type AttendanceSummaryResponse = { date: string; data: AttendanceSummaryRow[] }

type AttendanceRecordRow = {
  id: string
  status: "PRESENT" | "ABSENT"
  note: string | null
  student: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null
  teacher: { id: string; name: string; email: string } | null
  createdAt: string | null
}

type AttendanceRecordsResponse = {
  date: string
  class: { id: string; name: string; level: string | null }
  total: number
  data: AttendanceRecordRow[]
}

type AttendanceHistoryResponse = {
  class: { id: string; name: string }
  students: Array<{ id: string; name: string }>
  history: Record<string, Record<string, string>>
  startDate: string
  endDate: string
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

function statusLabel(status: "PRESENT" | "ABSENT") {
  return status === "PRESENT" ? "Present" : "Absent"
}

export default function AttendanceView() {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [date, setDate] = useState<string>(() => formatDateInputValue(new Date()))

  const [summary, setSummary] = useState<AttendanceSummaryResponse | null>(null)
  const [records, setRecords] = useState<AttendanceRecordsResponse | null>(null)
  const [history, setHistory] = useState<AttendanceHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState<"daily" | "history">("daily")

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const res = await api.get<ClassOption[]>("/api/classes")
        setClasses(res.data)
        if (res.data.length) setSelectedClassId((cur) => cur || res.data[0].id)
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
    if (!selectedClassId || selectedClassId === ALL_CLASS_VALUE) {
      setRecords(null)
      return
    }
    setLoadingRecords(true)
    try {
      const res = await api.get<AttendanceRecordsResponse>(
        `/api/attendance/records?date=${encodeURIComponent(date)}&classId=${encodeURIComponent(selectedClassId)}&limit=1000`,
      )
      setRecords(res.data)
    } catch (e: any) {
      toast({ title: "Failed to load records", description: getErrorMessage(e), variant: "destructive" })
      setRecords(null)
    } finally {
      setLoadingRecords(false)
    }
  }

  const loadHistory = async () => {
    if (!selectedClassId || selectedClassId === ALL_CLASS_VALUE) {
      setHistory(null)
      return
    }
    setLoadingHistory(true)
    try {
      const res = await api.get<AttendanceHistoryResponse>(`/api/attendance/history?classId=${selectedClassId}`)
      setHistory(res.data)
    } catch (e: any) {
      toast({ title: "Failed to load history", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (!date) return
    void loadSummary()
    void loadRecords()
    if (activeTab === "history") void loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedClassId, activeTab])

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
      }),
      { present: 0, absent: 0 },
    )
  }, [summaryRows])

  const dayRate = useMemo(() => {
    const total = dayTotals.present + dayTotals.absent
    return total > 0 ? Math.round((dayTotals.present / total) * 100) : 0
  }, [dayTotals])

  const downloadCsv = async () => {
    if (!selectedClassId || selectedClassId === ALL_CLASS_VALUE) return
    setDownloading(true)
    try {
      const data =
        records && records.date === date && records.class.id === selectedClassId
          ? records
          : (await api.get<AttendanceRecordsResponse>(
            `/api/attendance/records?date=${encodeURIComponent(date)}&classId=${encodeURIComponent(selectedClassId)}&limit=1000`,
          )).data
      const lines = [
        ["Date", "Class", "Student", "Status", "Teacher", "CreatedAt"].join(","),
        ...data.data.map((r) => {
          const studentName = r.student ? `${r.student.firstName} ${r.student.lastName}`.trim() : ""
          const teacherName = r.teacher ? r.teacher.name : ""
          const createdAt = r.createdAt ? new Date(r.createdAt).toISOString() : ""
          return [
            data.date,
            `"${data.class.name.replace(/"/g, '""')}"`,
            `"${studentName.replace(/"/g, '""')}"`,
            r.status,
            `"${teacherName.replace(/"/g, '""')}"`,
            createdAt,
          ].join(",")
        }),
      ].join("\n")

      const blob = new Blob([lines], { type: "text/csv;charset=utf-8" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `attendance-${data.class.name}-${data.date}.csv`.replace(/\s+/g, "-").toLowerCase()
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
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#2060AC]/10 via-background to-[#FCBE1A]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#2060AC]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/15 px-3 py-1 text-xs font-medium text-primary">
                <CalendarCheck className="w-3.5 h-3.5" />
                {dayRate}% attendance today
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
                {dayTotals.present} present
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700">
                {dayTotals.absent} absent
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
            disabled={!selectedClassId || selectedClassId === ALL_CLASS_VALUE || downloading || loading || loadingRecords}
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
          variant={activeTab === "history" ? "default" : "ghost"}
          className="rounded-full px-5 gap-2"
          onClick={() => setActiveTab("history")}
        >
          <History className="w-4 h-4" />
          History
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
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2060AC] to-[#FCBE1A] opacity-80" />
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
                        row.percentage >= 90 ? "text-emerald-600" : row.percentage >= 70 ? "text-[#2060AC]" : "text-amber-600"
                      }`}
                    >
                      {row.percentage}%
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 py-2.5 px-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Present</p>
                      <p className="text-lg font-bold text-emerald-800 tabular-nums">{row.presentCount}</p>
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
                    {records?.total ?? 0} records
                  </Badge>
                )}
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
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center w-[110px]">Status</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Teacher</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell text-right pr-6">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.data.map((r) => (
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
                          </div>
                        </TableCell>
                        <TableCell className="py-4 align-middle text-center">
                          <Badge
                            variant="secondary"
                            className={`inline-flex min-w-[80px] justify-center rounded-full shadow-none px-3 py-1 text-xs font-semibold ${
                              r.status === "PRESENT"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {statusLabel(r.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-4 text-sm text-foreground/80 align-middle">{r.teacher?.name ?? "—"}</TableCell>
                        <TableCell className="hidden md:table-cell py-4 text-sm text-muted-foreground text-right pr-6 font-mono">
                          {r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      ) : (
        <Card className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  30-Day History
                </h3>
                <p className="text-sm text-muted-foreground mt-1 capitalize">
                  {selectedClass?.name ?? "Select a single class to view history"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/30" /> None</span>
              </div>
            </div>
          </div>
          {loadingHistory ? (
            <div className="p-12 flex justify-center text-muted-foreground"><Spinner /></div>
          ) : !history || !history.students.length ? (
            <div className="p-12 text-center text-muted-foreground text-sm border-dashed">Select a class to view history.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="py-4 pl-6 sticky left-0 bg-background z-20 min-w-[200px] border-r">Student Name</TableHead>
                    {(() => {
                      const dates = []
                      const curr = new Date(history.startDate)
                      const end = new Date(history.endDate)
                      while (curr <= end) {
                        dates.push(curr.toISOString().split('T')[0])
                        curr.setDate(curr.getDate() + 1)
                      }
                      return dates.reverse().map(d => (
                        <TableHead key={d} className="text-center text-[10px] font-bold p-2 min-w-[45px] hover:bg-muted/50 transition-colors">
                          {d.split('-').slice(1).reverse().join('/')}
                        </TableHead>
                      ))
                    })()}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.students.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-3 pl-6 sticky left-0 bg-background z-10 font-bold border-r text-sm truncate max-w-[200px]">
                        {s.name}
                      </TableCell>
                      {(() => {
                        const dates = []
                        const curr = new Date(history.startDate)
                        const end = new Date(history.endDate)
                        while (curr <= end) {
                          dates.push(curr.toISOString().split('T')[0])
                          curr.setDate(curr.getDate() + 1)
                        }
                        return dates.reverse().map(d => {
                          const status = history.history[s.id]?.[d]
                          return (
                            <TableCell key={d} className="p-0 text-center">
                              <div className="flex items-center justify-center h-10 w-full group">
                                {status === "PRESENT" ? (
                                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" title={`${d}: Present`} />
                                ) : status === "ABSENT" ? (
                                  <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" title={`${d}: Absent`} />
                                ) : (
                                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" title={`${d}: No Record`} />
                                )}
                              </div>
                            </TableCell>
                          )
                        })
                      })()}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
