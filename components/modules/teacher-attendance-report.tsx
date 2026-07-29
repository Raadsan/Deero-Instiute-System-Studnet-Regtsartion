"use client"

import { useEffect, useMemo, useState } from "react"
import { Info, Search } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type TeacherClass = {
  id: string
  name: string
  courses: Array<{ id: string; name: string }>
}

type Report = {
  month: string
  class: { id: string; name: string }
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
  totals: { percentage: number | null }
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export default function TeacherAttendanceReport() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [classId, setClassId] = useState("")
  const [courseId, setCourseId] = useState("")
  const [month, setMonth] = useState(currentMonth)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

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
    return (report?.students ?? []).filter(
      (item) => !query || item.name.toLowerCase().includes(query) || item.studentCode.toLowerCase().includes(query),
    )
  }, [report, search])

  const generate = async () => {
    if (!classId || !month) return
    setLoading(true)
    try {
      const response = await api.get<Report>(
        `/api/attendance/monthly-report?classId=${encodeURIComponent(classId)}&month=${encodeURIComponent(month)}`,
      )
      setReport(response.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!classId || !month) return
    void generate()
    // Report refreshes automatically when the teacher changes class or month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, month])

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
                <SelectTrigger className="!h-14 w-full rounded-lg px-4 text-base shadow-sm">
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
                <SelectTrigger className="!h-14 w-full rounded-lg px-4 text-base shadow-sm"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-base font-semibold">Month</p>
              <Input type="month" className="!h-14 w-full rounded-lg px-4 text-base shadow-sm" value={month} onChange={(event) => setMonth(event.target.value)} />
            </div>
          </div>

          <div className="flex justify-center py-2">
            <Button
              className="h-12 min-w-44 rounded-full text-base"
              onClick={() => void generate()}
              disabled={!classId || !month || loading}
            >
              {loading ? <><Spinner className="mr-2" />Generating...</> : "Generate"}
            </Button>
          </div>

          <div className="flex h-14 overflow-hidden rounded-lg border bg-background">
            <div className="flex w-14 shrink-0 items-center justify-center bg-primary text-primary-foreground">
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

          {report ? (
            <div className="pt-6">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold sm:text-3xl">Report Student Attendance Rate</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedCourse?.name ?? report.courses[0]?.name ?? "Course"} · {report.class.name} · {new Date(`${report.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  {` · Overall ${report.totals.percentage ?? 0}%`}
                </p>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="h-14 pl-6 text-base font-semibold text-foreground">ID</TableHead>
                      <TableHead className="text-base font-semibold text-foreground">Name</TableHead>
                      <TableHead className="text-center text-base font-semibold text-foreground">Period</TableHead>
                      <TableHead className="text-center text-base font-semibold text-foreground">Present</TableHead>
                      <TableHead className="text-center text-base font-semibold text-foreground">Absent</TableHead>
                      <TableHead className="pr-6 text-right text-base font-semibold text-foreground">Percentage</TableHead>
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
                          {`${item.percentage ?? 0}%`}
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
              Select a class and month, then click Generate to view the report.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
