"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  BookOpen,
  Calendar,
  DollarSign,
  TrendingUp,
  GraduationCap,
  BarChart3,
  Wallet,
} from "lucide-react"
import { api } from "@/lib/api"
import { Spinner } from "@/components/ui/spinner"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"

type ReportsSummary = {
  totalStudents: number
  totalTeachers: number
  totalClasses: number
  attendanceRate: number
  paidStudents: number
  unpaidStudents: number
  monthlyRevenue: number
  lastMonthRevenue: number
  largestClasses: Array<{ name: string; students: number }>
  highestAbsenceClasses: Array<{ name: string; rate: number }>
  weeklyAttendance: Array<{ label: string; present: number; absent: number }>
  enrollmentTrends: Array<{ label: string; value: number }>
}

const enrollmentChartConfig = {
  students: { label: "New Students", color: "var(--chart-1)" },
} satisfies ChartConfig

const attendanceChartConfig = {
  present: { label: "Present", color: "var(--chart-1)" },
  absent: { label: "Absent", color: "var(--chart-2)" },
} satisfies ChartConfig

const paymentChartConfig = {
  paid: { label: "Paid", color: "var(--chart-1)" },
  unpaid: { label: "Unpaid", color: "var(--chart-2)" },
} satisfies ChartConfig

const classSizeChartConfig = {
  students: { label: "Students", color: "var(--chart-1)" },
} satisfies ChartConfig

const absenceChartConfig = {
  rate: { label: "Absence Rate", color: "var(--chart-2)" },
} satisfies ChartConfig

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function ChartCard({
  title,
  description,
  icon: Icon,
  children,
  className = "",
}: {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`border-muted/50 shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-foreground tracking-tight">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="shrink-0 p-2.5 rounded-xl bg-primary/8 text-primary">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="px-4 pb-6 pt-2">{children}</div>
    </Card>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-muted bg-muted/20 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export default function DashboardMetrics() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const summaryRes = await api.get<ReportsSummary>("/api/reports/summary")
        setSummary(summaryRes.data)
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e?.message ?? "Failed to load dashboard data.")
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const metrics = useMemo(() => {
    const revenueDelta = summary ? summary.monthlyRevenue - summary.lastMonthRevenue : 0
    return [
      {
        label: "Total Students",
        value: summary ? String(summary.totalStudents) : "—",
        hint: summary ? `${summary.totalTeachers} teachers` : "",
        icon: Users,
        accent: "from-[#003D9E]/15 to-[#003D9E]/5",
        iconBg: "bg-[#003D9E]",
      },
      {
        label: "Total Classes",
        value: summary ? String(summary.totalClasses) : "—",
        hint: "Active groups",
        icon: BookOpen,
        accent: "from-[#EC4724]/15 to-[#EC4724]/5",
        iconBg: "bg-[#EC4724]",
      },
      {
        label: "Attendance Rate",
        value: summary ? `${summary.attendanceRate.toFixed(1)}%` : "—",
        hint: "Last 7 days",
        icon: Calendar,
        accent: "from-emerald-500/15 to-emerald-500/5",
        iconBg: "bg-emerald-600",
      },
      {
        label: "Monthly Revenue",
        value: summary ? formatCurrency(summary.monthlyRevenue) : "—",
        hint: summary
          ? `${revenueDelta >= 0 ? "+" : ""}${formatCurrency(revenueDelta)} vs last month`
          : "",
        hintPositive: revenueDelta >= 0,
        icon: DollarSign,
        accent: "from-violet-500/15 to-violet-500/5",
        iconBg: "bg-violet-600",
      },
    ]
  }, [summary])

  const enrollmentData = useMemo(
    () => (summary?.enrollmentTrends ?? []).map((p) => ({ month: p.label, students: p.value })),
    [summary],
  )

  const attendanceData = useMemo(
    () => (summary?.weeklyAttendance ?? []).map((p) => ({ day: p.label, present: p.present, absent: p.absent })),
    [summary],
  )

  const paymentData = useMemo(() => {
    const paid = summary?.paidStudents ?? 0
    const unpaid = summary?.unpaidStudents ?? 0
    return [
      { status: "paid", count: paid, fill: "var(--color-paid)" },
      { status: "unpaid", count: unpaid, fill: "var(--color-unpaid)" },
    ]
  }, [summary])

  const classSizeData = useMemo(
    () => (summary?.largestClasses ?? []).map((c) => ({ name: c.name, students: c.students })),
    [summary],
  )

  const absenceData = useMemo(
    () => (summary?.highestAbsenceClasses ?? []).map((c) => ({ name: c.name, rate: c.rate })),
    [summary],
  )

  const paymentTotal = (summary?.paidStudents ?? 0) + (summary?.unpaidStudents ?? 0)
  const paidPercent = paymentTotal > 0 ? Math.round(((summary?.paidStudents ?? 0) / paymentTotal) * 100) : 0

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#003D9E]/10 via-background to-[#EC4724]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#003D9E]/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[#EC4724]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="secondary" className="rounded-full bg-background/80 backdrop-blur-sm border-primary/20 text-primary font-medium">
              Admin Dashboard
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Dashboard Overview</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Real-time insights into enrollment, attendance, payments, and class performance.
            </p>
          </div>
          <p className="text-sm text-muted-foreground font-medium shrink-0">{todayLabel}</p>
        </div>
      </div>

      {loading && (
        <Card className="p-12 border-dashed flex items-center justify-center gap-3 text-muted-foreground bg-muted/5">
          <Spinner className="w-6 h-6 text-primary" />
          <span>Loading dashboard...</span>
        </Card>
      )}

      {error && (
        <Card className="p-6 text-sm text-destructive border-destructive/20 bg-destructive/5">
          <span className="font-semibold">Error:</span> {error}
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
            {metrics.map((metric) => {
              const Icon = metric.icon
              return (
                <Card
                  key={metric.label}
                  className="relative overflow-hidden border-muted/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${metric.accent} pointer-events-none`} />
                  <div className="relative p-5 sm:p-6 flex items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{metric.label}</p>
                      <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight tabular-nums">{metric.value}</p>
                      {metric.hint && (
                        <p
                          className={`text-xs font-medium truncate ${
                            "hintPositive" in metric
                              ? metric.hintPositive
                                ? "text-emerald-600"
                                : "text-amber-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {metric.hint}
                        </p>
                      )}
                    </div>
                    <div className={`${metric.iconBg} p-3 rounded-xl shadow-sm shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Row 1: Enrollment + Payment */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-6">
            <ChartCard
              className="xl:col-span-2"
              title="Enrollment Growth"
              description="New students registered per month"
              icon={TrendingUp}
            >
              {enrollmentData.length === 0 ? (
                <EmptyChart message="No enrollment data yet" />
              ) : (
                <ChartContainer config={enrollmentChartConfig} className="h-[280px] w-full">
                  <AreaChart data={enrollmentData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="enrollmentFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-students)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-students)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-border/60" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} width={36} />
                    <ChartTooltip cursor={{ stroke: "var(--border)", strokeWidth: 1 }} content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="students"
                      stroke="var(--color-students)"
                      strokeWidth={2.5}
                      fill="url(#enrollmentFill)"
                      dot={{ fill: "var(--color-students)", r: 4, strokeWidth: 2, stroke: "var(--background)" }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </ChartCard>

            <ChartCard title="Payment Status" description="Paid vs unpaid students" icon={Wallet}>
              {paymentTotal === 0 ? (
                <EmptyChart message="No payment records yet" />
              ) : (
                <div className="space-y-4">
                  <ChartContainer config={paymentChartConfig} className="mx-auto h-[220px] w-full max-w-[240px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="status" />} />
                      <Pie
                        data={paymentData}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={62}
                        outerRadius={88}
                        paddingAngle={4}
                        strokeWidth={2}
                        stroke="var(--background)"
                      >
                        {paymentData.map((entry) => (
                          <Cell key={entry.status} fill={entry.fill} />
                        ))}
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                  <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 6} className="fill-foreground text-2xl font-bold">
                                    {paidPercent}%
                                  </tspan>
                                  <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 16} className="fill-muted-foreground text-xs">
                                    Paid
                                  </tspan>
                                </text>
                              )
                            }
                          }}
                        />
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#003D9E]/8 border border-[#003D9E]/15 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#003D9E]">Paid</p>
                      <p className="text-xl font-bold text-foreground tabular-nums">{summary?.paidStudents ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-[#EC4724]/8 border border-[#EC4724]/15 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#EC4724]">Unpaid</p>
                      <p className="text-xl font-bold text-foreground tabular-nums">{summary?.unpaidStudents ?? 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Row 2: Attendance */}
          <ChartCard
            title="Weekly Attendance"
            description="Present vs absent — last 7 days"
            icon={Calendar}
          >
            {attendanceData.every((d) => d.present === 0 && d.absent === 0) ? (
              <EmptyChart message="No attendance records this week" />
            ) : (
              <ChartContainer config={attendanceChartConfig} className="h-[300px] w-full">
                <BarChart data={attendanceData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} barGap={4}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-border/60" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} width={36} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="present" fill="var(--color-present)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="absent" fill="var(--color-absent)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ChartContainer>
            )}
          </ChartCard>

          {/* Row 3: Class insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
            <ChartCard title="Largest Classes" description="Top classes by student count" icon={GraduationCap}>
              {classSizeData.length === 0 ? (
                <EmptyChart message="No class data yet" />
              ) : (
                <ChartContainer config={classSizeChartConfig} className="h-[260px] w-full">
                  <BarChart
                    data={classSizeData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="4 4" className="stroke-border/60" />
                    <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={90}
                      tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="students" fill="var(--color-students)" radius={[0, 6, 6, 0]} maxBarSize={28} />
                  </BarChart>
                </ChartContainer>
              )}
            </ChartCard>

            <ChartCard title="Highest Absence Rate" description="Classes needing attention" icon={BarChart3}>
              {absenceData.length === 0 ? (
                <EmptyChart message="No absence data yet" />
              ) : (
                <ChartContainer config={absenceChartConfig} className="h-[260px] w-full">
                  <BarChart
                    data={absenceData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="4 4" className="stroke-border/60" />
                    <XAxis type="number" tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={90}
                      tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`${v}%`, "Absence"]} />} />
                    <Bar dataKey="rate" fill="var(--color-rate)" radius={[0, 6, 6, 0]} maxBarSize={28} />
                  </BarChart>
                </ChartContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}
