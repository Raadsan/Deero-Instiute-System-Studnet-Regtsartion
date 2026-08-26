"use client"

import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Users, GraduationCap, CalendarCheck, CalendarX2, FileBarChart, Search, ArrowLeft, ChevronRight } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { formatScheduleDays, getDefaultAttendanceDate, isDateInputOnSchedule, formatDateInputValue } from "@/lib/class-schedule"

type TeacherClass = {
  id: string
  name: string
  level: string | null
  studentsCount: number
  scheduleDays: number[]
}

type StudentRow = {
  id: string
  studentCode: string
  firstName: string
  lastName: string
  attendancePercentage?: number | null
}

type AttendanceStatus = "PRESENT" | "ABSENT"

type MonthlyReport = {
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
    percentage: number | null
  }>
  totals: { period: number; present: number; absent: number; percentage: number | null }
}

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

export default function TeacherAttendance() {
  // Reports live on the dedicated /attendance-report page.
  const showReport = false
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [date, setDate] = useState<string>(() => formatDateInputValue(new Date()))

  const [students, setStudents] = useState<StudentRow[]>([])
  const [statusByStudentId, setStatusByStudentId] = useState<Record<string, AttendanceStatus>>({})
  const [noteByStudentId, setNoteByStudentId] = useState<Record<string, string>>({})

  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reportMonth, setReportMonth] = useState(() => formatDateInputValue(new Date()).slice(0, 7))
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportSearch, setReportSearch] = useState("")

  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  useEffect(() => {
    const run = async () => {
      setLoadingClasses(true)
      try {
        const res = await api.get<TeacherClass[]>("/api/attendance/classes")
        setClasses(res.data)
        const requestedClassId = new URLSearchParams(window.location.search).get("classId")
        if (requestedClassId && res.data.some((item) => item.id === requestedClassId)) {
          setSelectedClassId(requestedClassId)
        }
      } catch (e: any) {
        toast({ title: "Failed to load classes", description: getErrorMessage(e), variant: "destructive" })
      } finally {
        setLoadingClasses(false)
      }
    }
    void run()
  }, [])

  const selectedClass = useMemo(() => classes.find((c) => c.id === selectedClassId) ?? null, [classes, selectedClassId])

  const isScheduledDay = useMemo(() => {
    const days = selectedClass?.scheduleDays ?? []
    return isDateInputOnSchedule(days, date)
  }, [selectedClass, date])

  useEffect(() => {
    const cls = classes.find((c) => c.id === selectedClassId)
    if (!cls?.scheduleDays?.length) return
    setDate(getDefaultAttendanceDate(cls.scheduleDays))
  }, [selectedClassId, classes])

  const handleDateChange = (value: string) => {
    const days = selectedClass?.scheduleDays ?? []
    if (days.length && !isDateInputOnSchedule(days, value)) {
      toast({
        title: "Not a class day",
        description: `This class meets on ${formatScheduleDays(days)} only.`,
        variant: "destructive",
      })
      return
    }
    setDate(value)
  }

  const overview = useMemo(() => {
    const totalStudents = classes.reduce((sum, c) => sum + (c.studentsCount ?? 0), 0)
    const presentToday = students.filter((s) => (statusByStudentId[s.id] ?? "ABSENT") === "PRESENT").length
    const absentToday = students.filter((s) => (statusByStudentId[s.id] ?? "ABSENT") === "ABSENT").length
    return {
      classCount: classes.length,
      totalStudents,
      presentToday,
      absentToday,
    }
  }, [classes, students, statusByStudentId])

  useEffect(() => {
    const run = async () => {
      if (!selectedClassId) {
        setStudents([])
        setStatusByStudentId({})
        setNoteByStudentId({})
        return
      }

      const days = selectedClass?.scheduleDays ?? []
      if (!days.length || !isDateInputOnSchedule(days, date)) {
        setStudents([])
        setStatusByStudentId({})
        setNoteByStudentId({})
        return
      }

      setLoadingStudents(true)
      try {
        const res = await api.get<{
          students: StudentRow[]
          attendance: Record<string, AttendanceStatus>
          notes: Record<string, string>
        }>(
          `/api/attendance/classes/${selectedClassId}/students?date=${encodeURIComponent(date)}`,
        )
        setStudents(res.data.students)
        setStatusByStudentId(res.data.attendance ?? {})
        setNoteByStudentId(res.data.notes ?? {})
      } catch (e: any) {
        toast({ title: "Failed to load students", description: getErrorMessage(e), variant: "destructive" })
      } finally {
        setLoadingStudents(false)
      }
    }
    void run()
  }, [selectedClassId, date, selectedClass?.scheduleDays])

  const markAll = (status: AttendanceStatus) => {
    setStatusByStudentId((current) => {
      const next = { ...current }
      for (const s of filteredStudents) next[s.id] = status
      return next
    })
  }

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const currentStatus = statusByStudentId[s.id] ?? "ABSENT" // Or actually, if we want to filter truly unmarked, wait, default is always ABSENT in UI? Actually in load it's either PRESENT or ABSENT.
      const isUnmarked = statusByStudentId[s.id] === undefined
      
      // Status Filter
      if (statusFilter === "PRESENT" && currentStatus !== "PRESENT") return false
      if (statusFilter === "ABSENT" && currentStatus !== "ABSENT") return false
      
      return true
    })
  }, [students, statusByStudentId, statusFilter])

  const submit = async () => {
    if (!selectedClassId) return
    if (!isScheduledDay) {
      toast({
        title: "Not a class day",
        description: "You can only mark attendance on scheduled class days.",
        variant: "destructive",
      })
      return
    }
    if (!students.length) {
      toast({ title: "No students in this class", variant: "destructive" })
      return
    }

    const items = students.map((s) => {
      const status = statusByStudentId[s.id] ?? "ABSENT"
      return {
        studentId: s.id,
        status,
        note: status === "ABSENT" ? noteByStudentId[s.id]?.trim() || undefined : undefined,
      }
    })

    setSubmitting(true)
    try {
      await api.post("/api/attendance", { date, classId: selectedClassId, items })
      toast({ title: "Attendance saved" })
    } catch (e: any) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const generateMonthlyReport = async () => {
    if (!selectedClassId || !reportMonth) return
    setLoadingReport(true)
    try {
      const response = await api.get<MonthlyReport>(
        `/api/attendance/monthly-report?classId=${encodeURIComponent(selectedClassId)}&month=${encodeURIComponent(reportMonth)}`,
      )
      setMonthlyReport(response.data)
    } catch (e: any) {
      setMonthlyReport(null)
      toast({ title: "Report failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setLoadingReport(false)
    }
  }

  const reportStudents = useMemo(() => {
    const query = reportSearch.trim().toLowerCase()
    if (!query) return monthlyReport?.students ?? []
    return (monthlyReport?.students ?? []).filter(
      (student) => student.name.toLowerCase().includes(query) || student.studentCode.toLowerCase().includes(query),
    )
  }, [monthlyReport, reportSearch])

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#003D9E]/10 via-background to-[#EC4724]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#003D9E]/10 blur-3xl" />
        <div className="relative space-y-2">
          <Badge variant="secondary" className="rounded-full bg-background/80 border-primary/20 text-primary font-medium">
            Teacher Dashboard
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">My Classes & Attendance</h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
            View your assigned classes and mark student attendance for each day.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 sm:p-5 border-muted/50 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My Classes</p>
              <p className="text-2xl font-bold text-[#003D9E] mt-1">{overview.classCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#003D9E]/10 text-[#003D9E]">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5 border-muted/50 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Students</p>
              <p className="text-2xl font-bold text-foreground mt-1">{overview.totalStudents}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5 border-muted/50 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Present Today</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{overview.presentToday}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-700">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5 border-muted/50 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Absent Today</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{overview.absentToday}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-700">
              <CalendarX2 className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {!loadingClasses && classes.length === 0 && (
        <Card className="p-6 border-dashed text-sm text-muted-foreground">
          No classes assigned to you yet. Ask the admin to assign your classes.
        </Card>
      )}

      {!selectedClassId && classes.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">My Classes</h2>
            <p className="text-sm text-muted-foreground mt-1">Choose a class to view its students and take attendance.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {classes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedClassId(item.id)}
                className="group text-left rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <h3 className="mt-5 text-lg font-bold capitalize">{item.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.level ? `Level ${item.level}` : "Class"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">{item.studentsCount} students</Badge>
                  <Badge variant="outline">{formatScheduleDays(item.scheduleDays ?? [])}</Badge>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedClassId && selectedClass && (
        <>
          <div className="hidden">
            <Button variant="ghost" className="w-fit gap-2 -ml-2" onClick={() => {
              setSelectedClassId("")
              setMonthlyReport(null)
            }}>
              <ArrowLeft className="h-4 w-4" />
              Back to my classes
            </Button>
            <Badge variant="outline" className="w-fit py-1.5 px-3">
              {selectedClass.name} · {selectedClass.studentsCount} students
            </Badge>
          </div>

      {showReport && <Card className="overflow-hidden border-muted/50 shadow-sm">
        <div className="p-5 sm:p-6 border-b bg-muted/20">
          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-primary" />
              Student Attendance Rate Report
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Select your class and month to view a clear attendance report.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <p className="text-sm font-medium">Month</p>
              <input
                type="month"
                className="w-full h-11 px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={reportMonth}
                onChange={(event) => setReportMonth(event.target.value)}
              />
            </div>
            <Button className="h-11 gap-2" onClick={() => void generateMonthlyReport()} disabled={!selectedClassId || !reportMonth || loadingReport}>
              {loadingReport ? <Spinner className="w-4 h-4" /> : <FileBarChart className="w-4 h-4" />}
              Generate Report
            </Button>
          </div>
        </div>

        {monthlyReport && (
          <>
            <div className="p-5 sm:p-6 border-b space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Report Student Attendance Rate</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {monthlyReport.courses.map((course) => course.name).join(", ") || "No course"} · {monthlyReport.class.name} · {new Date(`${monthlyReport.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </p>
                </div>
                <Badge variant="outline" className="w-fit py-2 px-3">
                  Overall: {monthlyReport.totals.percentage == null ? "No records" : `${monthlyReport.totals.percentage}%`}
                </Badge>
              </div>
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  className="w-full h-10 pl-9 pr-3 border border-input rounded-lg bg-background"
                  placeholder="Search student name or ID..."
                  value={reportSearch}
                  onChange={(event) => setReportSearch(event.target.value)}
                />
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
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-right pr-6">Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="pl-6 font-mono text-xs text-muted-foreground">{student.studentCode}</TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">{student.name}</TableCell>
                      <TableCell className="text-center tabular-nums">{student.period}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-700 tabular-nums">{student.present}</TableCell>
                      <TableCell className="text-center font-semibold text-rose-700 tabular-nums">{student.absent}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge variant="outline" className={student.percentage == null ? "text-muted-foreground" : student.percentage >= 80 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                          {student.percentage == null ? "No records" : `${student.percentage}%`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!reportStudents.length && (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No students found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">Mark Attendance</h2>
          <p className="text-sm text-muted-foreground">Mark attendance and add an excuse or reason for absent students.</p>
        </div>
        <div className="hidden sm:block">
          <Button className="w-full sm:w-auto px-8 rounded-full" onClick={submit} disabled={submitting || loadingStudents || !selectedClassId || !isScheduledDay}>
            {submitting ? (
              <>
                <Spinner className="mr-2" />
                Saving...
              </>
            ) : (
              "Submit Attendance"
            )}
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Date</p>
            <input
              type="date"
              className="w-full h-11 px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
            />
          </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Action</p>
              <div className="flex gap-2">
                <Button className="flex-1 h-11 border-2" variant="outline" onClick={() => markAll("PRESENT")} disabled={!filteredStudents.length}>
                  All Present
                </Button>
                <Button className="flex-1 h-11 border-2" variant="outline" onClick={() => markAll("ABSENT")} disabled={!filteredStudents.length}>
                  All Absent
                </Button>
              </div>
            </div>
          </div>
          
          {/* Filters Row */}
          <div className="grid grid-cols-1 gap-4 pt-4 border-t border-muted/50">
             <div className="space-y-2">
               <p className="text-sm font-medium">Filter by Status</p>
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                 <SelectTrigger className="h-11">
                   <SelectValue placeholder="All Statuses" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="ALL">All Students</SelectItem>
                   <SelectItem value="PRESENT">Present</SelectItem>
                   <SelectItem value="ABSENT">Absent</SelectItem>
                 </SelectContent>
               </Select>
             </div>
          </div>
        </Card>

      {selectedClass && !(selectedClass.scheduleDays ?? []).length && (
        <Card className="p-4 border-amber-200 bg-amber-50 text-amber-900 text-sm">
          This class has no scheduled days yet. Ask the admin to set class days before taking attendance.
        </Card>
      )}

      {selectedClass && (selectedClass.scheduleDays ?? []).length > 0 && !isScheduledDay && (
        <Card className="p-4 border-amber-200 bg-amber-50 text-amber-900 text-sm">
          This class meets on <strong>{formatScheduleDays(selectedClass.scheduleDays ?? [])}</strong> only.
          Today&apos;s selected date is not a class day — pick Wed or Fri to mark attendance.
        </Card>
      )}

      <Card className={`overflow-hidden mb-20 sm:mb-0 ${!isScheduledDay ? "opacity-60 pointer-events-none" : ""}`}>
        {loadingStudents ? (
          <div className="p-12 flex flex-col items-center gap-4 text-muted-foreground">
            <Spinner className="w-8 h-8" />
            <p className="animate-pulse">Loading class list...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground border-dashed">
            <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 opacity-40" />
            </div>
            <p>No students found for this class.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden p-3 space-y-3 bg-muted/20">
              {filteredStudents.map((s, index) => {
                const status = statusByStudentId[s.id] ?? "ABSENT"
                const pct = s.attendancePercentage
                const badgeColor = pct == null ? "bg-muted text-muted-foreground" : pct >= 80 ? "bg-emerald-100 text-emerald-800" : pct >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                
                return (
                  <div key={s.id} className="bg-muted/30 p-4 rounded-xl border border-border space-y-3 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-lg mb-1">{s.firstName} {s.lastName}</div>
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-muted-foreground font-mono">No. {index + 1}</span>
                          <Badge variant="outline" className={`text-[10px] border-transparent ${badgeColor}`}>
                            {pct != null ? `${pct}% att` : 'N/A'}
                          </Badge>
                        </div>
                      </div>
                      <Badge 
                        variant={status === "PRESENT" ? "default" : "destructive"} 
                        className="rounded-full px-3 py-0.5 text-[10px] h-fit font-bold"
                      >
                        {status}
                      </Badge>
                    </div>

                    <label
                      className={`ml-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
                        status === "PRESENT"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={status === "PRESENT"}
                        onChange={(event) =>
                          setStatusByStudentId((cur) => ({
                            ...cur,
                            [s.id]: event.target.checked ? "PRESENT" : "ABSENT",
                          }))
                        }
                        aria-label={`Mark ${s.firstName} ${s.lastName} present`}
                        className="h-5 w-5 rounded accent-emerald-600"
                      />
                    </label>
                    {status === "ABSENT" && (
                      <div className="space-y-1.5">
                        <label htmlFor={`mobile-excuse-${s.id}`} className="text-xs font-semibold text-foreground">
                          Excuse / reason for absence
                        </label>
                        <Textarea
                          id={`mobile-excuse-${s.id}`}
                          value={noteByStudentId[s.id] ?? ""}
                          onChange={(event) =>
                            setNoteByStudentId((current) => ({ ...current, [s.id]: event.target.value }))
                          }
                          maxLength={500}
                          rows={2}
                          placeholder="Write the student's excuse or reason..."
                          className="min-h-20 resize-y bg-background"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[100px] py-4 pl-6">No.</TableHead>
                    <TableHead className="py-4">Full Name</TableHead>
                    <TableHead className="py-4">Attendance %</TableHead>
                    <TableHead className="py-4">Status</TableHead>
                    <TableHead className="py-4 min-w-[280px]">Excuse / Reason</TableHead>
                    <TableHead className="py-4 text-right pr-6">Quick Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s, index) => {
                    const status = statusByStudentId[s.id] ?? "ABSENT"
                    const pct = s.attendancePercentage
                    const badgeColor = pct == null ? "bg-muted text-muted-foreground" : pct >= 80 ? "bg-emerald-100 text-emerald-800" : pct >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                    return (
                      <TableRow key={s.id} className="hover:bg-muted/40 transition-colors border-b">
                        <TableCell className="pl-6 py-4 font-mono text-xs text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="py-4 font-bold text-foreground font-medium">
                          {s.firstName} {s.lastName}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex gap-2 items-center">
                            <Badge variant="outline" className={`text-[10px] border-transparent ${badgeColor}`}>
                              {pct != null ? `${pct}%` : 'N/A'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge 
                            variant={status === "PRESENT" ? "default" : "secondary"}
                            className={status === "ABSENT" ? "bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200" : ""}
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          {status === "ABSENT" ? (
                            <Textarea
                              value={noteByStudentId[s.id] ?? ""}
                              onChange={(event) =>
                                setNoteByStudentId((current) => ({ ...current, [s.id]: event.target.value }))
                              }
                              maxLength={500}
                              rows={2}
                              aria-label={`Excuse or reason for ${s.firstName} ${s.lastName}`}
                              placeholder="Write an excuse or reason..."
                              className="min-h-16 resize-y bg-background"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">Available when absent</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 text-right pr-6">
                          <label
                            className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
                              status === "PRESENT"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={status === "PRESENT"}
                              onChange={(event) =>
                                setStatusByStudentId((cur) => ({
                                  ...cur,
                                  [s.id]: event.target.checked ? "PRESENT" : "ABSENT",
                                }))
                              }
                              aria-label={`Mark ${s.firstName} ${s.lastName} present`}
                              className="h-5 w-5 rounded accent-emerald-600"
                            />
                          </label>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {/* Floating Action Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border sm:hidden z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <Button 
          className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20" 
          onClick={submit} 
          disabled={submitting || loadingStudents || !selectedClassId}
        >
          {submitting ? (
            <>
              <Spinner className="mr-2" />
              Saving Attendance...
            </>
          ) : (
            "Complete & Submit"
          )}
        </Button>
      </div>
        </>
      )}
    </div>
  )
}
