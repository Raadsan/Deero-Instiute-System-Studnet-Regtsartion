"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarCheck, FileBarChart, GraduationCap, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { formatScheduleDays } from "@/lib/class-schedule"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

type TeacherClass = {
  id: string
  name: string
  level: string | null
  studentsCount: number
  scheduleDays: number[]
}

type AttendanceCharts = {
  present: number
  absent: number
  rate: number
  daily: Array<{ label: string; present: number; absent: number }>
  byClass: Array<{ name: string; present: number; absent: number; rate: number }>
}

const attendanceConfig = {
  present: { label: "Present", color: "#10b981" },
  absent: { label: "Absent", color: "#f97316" },
} satisfies ChartConfig

const rateConfig = {
  rate: { label: "Attendance Rate", color: "#0b4db8" },
} satisfies ChartConfig

export default function TeacherDashboard() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [loading, setLoading] = useState(true)
  const [charts, setCharts] = useState<AttendanceCharts | null>(null)

  useEffect(() => {
    void Promise.all([
      api.get<TeacherClass[]>("/api/attendance/classes"),
      api.get<AttendanceCharts>("/api/attendance/teacher-dashboard"),
    ])
      .then(([classResponse, chartResponse]) => {
        setClasses(classResponse.data)
        setCharts(chartResponse.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const totalStudents = useMemo(() => classes.reduce((sum, item) => sum + item.studentsCount, 0), [classes])

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 via-background to-[#EC4724]/5 p-6 sm:p-8">
        <Badge variant="secondary" className="rounded-full">Teacher Dashboard</Badge>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Welcome back</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground sm:text-base">
          Your classes, students, attendance and reports are organized in one simple workspace.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-5"><p className="text-xs font-semibold uppercase text-muted-foreground">My Classes</p><p className="mt-1 text-3xl font-bold text-primary">{classes.length}</p></Card>
        <Card className="p-5"><p className="text-xs font-semibold uppercase text-muted-foreground">My Students</p><p className="mt-1 text-3xl font-bold">{totalStudents}</p></Card>
        <Card className="col-span-2 flex items-center justify-between gap-4 p-5">
          <div><p className="font-semibold">Ready to take attendance?</p><p className="text-sm text-muted-foreground">Choose one of your classes below.</p></div>
          <CalendarCheck className="h-8 w-8 text-emerald-600" />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-primary/10 p-3 text-primary"><GraduationCap /></div>
            <div><h2 className="font-bold">Classes & Attendance</h2><p className="text-sm text-muted-foreground">Open a class and manage its students.</p></div>
          </div>
          <Button asChild size="icon" variant="ghost"><Link href="/teacher-classes"><ArrowRight /></Link></Button>
        </Card>
        <Card className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-700"><FileBarChart /></div>
            <div><h2 className="font-bold">Attendance Reports</h2><p className="text-sm text-muted-foreground">Generate a monthly class report.</p></div>
          </div>
          <Button asChild size="icon" variant="ghost"><Link href="/attendance-report"><ArrowRight /></Link></Button>
        </Card>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Attendance Overview</h2>
          <p className="text-sm text-muted-foreground">Your attendance activity during the last 7 days.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-12">
          <Card className="p-5 sm:p-6 xl:col-span-7">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div><h3 className="font-bold">Weekly Attendance</h3><p className="text-sm text-muted-foreground">Present and absent students by day</p></div>
              <Badge variant="outline">{charts?.rate ?? 0}% rate</Badge>
            </div>
            <ChartContainer config={attendanceConfig} className="h-[280px] w-full">
              <BarChart data={charts?.daily ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="present" fill="var(--color-present)" radius={[5, 5, 0, 0]} maxBarSize={36} />
                <Bar dataKey="absent" fill="var(--color-absent)" radius={[5, 5, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ChartContainer>
          </Card>

          <Card className="p-5 sm:p-6 xl:col-span-5">
            <div className="mb-3"><h3 className="font-bold">Present vs Absent</h3><p className="text-sm text-muted-foreground">Last 7 days total</p></div>
            <div className="grid items-center gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <ChartContainer config={attendanceConfig} className="mx-auto h-[220px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={[
                      { name: "Present", value: charts?.present ?? 0, fill: "var(--color-present)" },
                      { name: "Absent", value: charts?.absent ?? 0, fill: "var(--color-absent)" },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={82}
                    strokeWidth={0}
                  >
                    {[0, 1].map((index) => <Cell key={index} />)}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase text-emerald-700">Present</p><p className="text-2xl font-bold text-emerald-800">{charts?.present ?? 0}</p></div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4"><p className="text-xs font-semibold uppercase text-orange-700">Absent</p><p className="text-2xl font-bold text-orange-800">{charts?.absent ?? 0}</p></div>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 xl:col-span-12">
            <div className="mb-5"><h3 className="font-bold">Attendance Rate by Class</h3><p className="text-sm text-muted-foreground">Compare your classes over the last 7 days</p></div>
            <ChartContainer config={rateConfig} className="h-[260px] w-full">
              <BarChart data={charts?.byClass ?? []} layout="vertical" margin={{ left: 20, right: 24 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="rate" fill="var(--color-rate)" radius={[0, 6, 6, 0]} maxBarSize={30} />
              </BarChart>
            </ChartContainer>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div><h2 className="text-xl font-bold">My Classes</h2><p className="text-sm text-muted-foreground">Select a class to view its students.</p></div>
          <Button asChild variant="outline"><Link href="/teacher-classes">View all</Link></Button>
        </div>
        {loading ? <Card className="flex justify-center p-12"><Spinner /></Card> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((item) => (
              <Link key={item.id} href={`/teacher-classes?classId=${encodeURIComponent(item.id)}`} className="group">
                <Card className="h-full p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
                  <div className="flex items-start justify-between"><GraduationCap className="text-primary" /><ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" /></div>
                  <h3 className="mt-4 text-lg font-bold capitalize">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.level ? `Level ${item.level}` : "Class"}</p>
                  <div className="mt-4 flex flex-wrap gap-2"><Badge variant="secondary"><Users className="mr-1 h-3 w-3" />{item.studentsCount}</Badge><Badge variant="outline">{formatScheduleDays(item.scheduleDays)}</Badge></div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
