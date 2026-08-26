"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarCheck, GraduationCap, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
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
  rate: { label: "Attendance Rate", color: "#003D9E" },
} satisfies ChartConfig

export default function TeacherDashboard() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
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
  }, [])

  const totalStudents = useMemo(() => classes.reduce((sum: number, item: TeacherClass) => sum + item.studentsCount, 0), [classes])

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#003D9E]/10 via-background to-[#EC4724]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#003D9E]/10 blur-3xl" />
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/15 px-3 py-1 text-xs font-medium text-[#003D9E]">
            <CalendarCheck className="w-3.5 h-3.5" />
            Teacher Dashboard
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
            Your classes, students, attendance and reports are organized in one simple workspace.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden p-5 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border border-muted-foreground/10 bg-background/50 backdrop-blur-sm">
          <div className="absolute -right-4 -bottom-4 text-[#003D9E]/5">
            <GraduationCap className="h-20 w-20" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#003D9E]/10 text-[#003D9E]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Classes</p>
              <p className="mt-1 text-3xl font-extrabold text-[#003D9E] tabular-nums">{classes.length}</p>
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden p-5 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border border-muted-foreground/10 bg-background/50 backdrop-blur-sm">
          <div className="absolute -right-4 -bottom-4 text-[#EC4724]/5">
            <Users className="h-20 w-20" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#EC4724]/10 text-[#EC4724]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Students</p>
              <p className="mt-1 text-3xl font-extrabold text-foreground tabular-nums">{totalStudents}</p>
            </div>
          </div>
        </Card>

        <Card className="col-span-1 sm:col-span-2 relative overflow-hidden p-5 border border-muted-foreground/10 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 backdrop-blur-sm">
          <div className="absolute -right-8 -bottom-8 text-emerald-500/10 animate-pulse">
            <CalendarCheck className="h-28 w-28" />
          </div>
          <div className="flex h-full items-center justify-between gap-4 relative">
            <div>
              <h3 className="font-bold text-emerald-950 dark:text-emerald-50">Ready to take attendance?</h3>
              <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80 mt-0.5">Select one of your classes from the sidebar to record today's attendance.</p>
            </div>
            <div className="p-3 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <CalendarCheck className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Attendance Overview</h2>
          <p className="text-sm text-muted-foreground">Your attendance activity during the last 7 days.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-12">
          <Card className="p-5 sm:p-6 xl:col-span-7 border-muted/50 shadow-xs">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">Weekly Attendance</h3>
                <p className="text-sm text-muted-foreground">Present and absent students by day</p>
              </div>
              <Badge variant="outline" className="border-primary/20 text-[#003D9E] bg-[#003D9E]/5 font-medium">{charts?.rate ?? 0}% rate</Badge>
            </div>
            <ChartContainer config={attendanceConfig} className="h-[280px] w-full">
              <BarChart data={charts?.daily ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.8}/>
                  </linearGradient>
                  <linearGradient id="absentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs text-muted-foreground" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs text-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="present" fill="url(#presentGradient)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="absent" fill="url(#absentGradient)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          </Card>

          <Card className="p-5 sm:p-6 xl:col-span-5 border-muted/50 shadow-xs">
            <div className="mb-3">
              <h3 className="font-bold">Present vs Absent</h3>
              <p className="text-sm text-muted-foreground">Last 7 days total</p>
            </div>
            <div className="grid items-center gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="relative mx-auto h-[220px] w-[220px] flex items-center justify-center">
                <ChartContainer config={attendanceConfig} className="h-full w-full">
                  <PieChart>
                    <defs>
                      <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.8}/>
                      </linearGradient>
                      <linearGradient id="absentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0.8}/>
                      </linearGradient>
                    </defs>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={[
                        { name: "Present", value: charts?.present ?? 0, fill: "url(#presentGradient)" },
                        { name: "Absent", value: charts?.absent ?? 0, fill: "url(#absentGradient)" },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {[0, 1].map((index) => <Cell key={index} />)}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">{charts?.rate ?? 0}%</span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Attendance</span>
                </div>
              </div>
              <div className="space-y-3 w-full">
                <div className="relative overflow-hidden rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4 transition-all hover:bg-emerald-500/10">
                  <div className="absolute top-0 right-0 h-16 w-16 -translate-y-4 translate-x-4 rounded-full bg-emerald-500/10 blur-xl" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Present</p>
                  <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">{charts?.present ?? 0}</p>
                </div>
                <div className="relative overflow-hidden rounded-xl border border-orange-500/10 bg-orange-500/5 p-4 transition-all hover:bg-orange-500/10">
                  <div className="absolute top-0 right-0 h-16 w-16 -translate-y-4 translate-x-4 rounded-full bg-orange-500/10 blur-xl" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">Absent</p>
                  <p className="text-3xl font-extrabold text-orange-700 dark:text-orange-300 mt-1 tabular-nums">{charts?.absent ?? 0}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 xl:col-span-12 border-muted/50 shadow-xs">
            <div className="mb-5">
              <h3 className="font-bold">Attendance Rate by Class</h3>
              <p className="text-sm text-muted-foreground">Compare your classes over the last 7 days</p>
            </div>
            <ChartContainer config={rateConfig} className="h-[260px] w-full">
              <BarChart data={charts?.byClass ?? []} layout="vertical" margin={{ left: 20, right: 24 }}>
                <defs>
                  <linearGradient id="rateGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#003D9E" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="#005CFF" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} className="text-xs text-muted-foreground" />
                <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} className="text-xs text-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="rate" fill="url(#rateGradient)" radius={[0, 6, 6, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
          </Card>
        </div>
      </section>
    </div>
  )
}
