"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
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
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"

import { api } from "@/lib/api"
import { formatMoney } from "@/lib/finance-utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Label as FormLabel } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"

type AdminReport = {
  range: { from: string; to: string; label: string }
  overview: {
    totalStudents: number
    totalTeachers: number
    totalClasses: number
    enrolledStudents: number
    visitScheduledStudents: number
    paidStudents: number
    unpaidStudents: number
    registrarsCount: number
    financeUsersCount: number
    attendanceRate: number
  }
  money: {
    studentFeesAllTime: number
    studentFeesPeriod: number
    studentFeesThisMonth: number
    teacherPayoutsPeriod: number
    teacherPayoutsThisMonth: number
    partnerPayoutsPeriod: number
    partnerPayoutsThisMonth: number
    staffPayoutsPeriod: number
    staffPayoutsThisMonth: number
    manualIncomePeriod: number
    manualExpensePeriod: number
    totalIncomePeriod: number
    totalExpensesPeriod: number
    netBalancePeriod: number
    teacherBalanceDue: number
    partnerBalanceDue: number
    staffBalanceDue: number
  }
  payroll: {
    staff: Array<{
      id: string
      name: string
      jobTitle: string | null
      monthlySalary: number
      totalPaidOut: number
      balanceDue: number
    }>
    teachers: Array<{
      id: string
      name: string
      email: string
      monthlyPay: number
      totalPaidOut: number
      balanceDue: number
      contractsCount: number
    }>
    partners: Array<{
      id: string
      name: string
      monthlyDue: number
      totalPaidOut: number
      balanceDue: number
      studentsCount: number
    }>
  }
  weeklyAttendance: Array<{ label: string; present: number; absent: number }>
  enrollmentTrends: Array<{ label: string; value: number }>
  attendanceByClass: Array<{
    classId: string
    className: string
    present: number
    absent: number
    total: number
    absentRate: number
  }>
  unpaidStudents: Array<{ id: string; name: string; phone: string | null; className: string | null }>
  visitScheduled: Array<{
    id: string
    name: string
    phone: string | null
    visitDate: string | null
    visitNote: string | null
  }>
  transactions: Array<{
    date: string
    category: string
    name: string
    description: string
    amount: number
    direction: "income" | "expense"
  }>
  transactionTotals: {
    totalIncome: number
    totalExpenses: number
    netBalance: number
    transactionCount: number
  }
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

function getErrorMessage(error: unknown) {
  const err = error as { response?: { data?: { message?: string } }; message?: string }
  return err?.response?.data?.message ?? err?.message ?? "Something went wrong."
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function ChartCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Card className="border-muted/50 shadow-sm overflow-hidden">
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
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-muted bg-muted/20 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  iconBg,
}: {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  iconBg: string
}) {
  return (
    <Card className="relative overflow-hidden border-muted/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} pointer-events-none`} />
      <div className="relative p-5 sm:p-6 flex items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground font-medium">{hint}</p>
        </div>
        <div className={`shrink-0 p-2.5 rounded-xl text-white shadow-sm ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  )
}

function MoneyTile({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "income" | "expense" | "accent" }) {
  const toneClass =
    tone === "income"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "expense"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : tone === "accent"
          ? "border-[#2060AC]/20 bg-gradient-to-br from-[#2060AC]/10 to-transparent text-[#2060AC]"
          : "border-muted bg-muted/20 text-foreground"

  return (
    <div className={`p-4 rounded-xl border ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1">{value}</p>
    </div>
  )
}

export default function ReportsView() {
  const [report, setReport] = useState<AdminReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null)
  const [period, setPeriod] = useState("3m")
  const [month, setMonth] = useState("")

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (month.trim()) params.set("month", month.trim())
    else params.set("period", period)
    return params.toString()
  }, [period, month])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<AdminReport>(`/api/reports/overview?${buildQuery()}`)
      setReport(res.data)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  const enrollmentData = useMemo(
    () => (report?.enrollmentTrends ?? []).map((p) => ({ month: p.label, students: p.value })),
    [report],
  )
  const attendanceData = useMemo(
    () => (report?.weeklyAttendance ?? []).map((p) => ({ day: p.label, present: p.present, absent: p.absent })),
    [report],
  )
  const paymentData = useMemo(() => {
    const paid = report?.overview.paidStudents ?? 0
    const unpaid = report?.overview.unpaidStudents ?? 0
    return [
      { status: "paid", count: paid, fill: "var(--color-paid)" },
      { status: "unpaid", count: unpaid, fill: "var(--color-unpaid)" },
    ]
  }, [report])

  const paymentTotal = (report?.overview.paidStudents ?? 0) + (report?.overview.unpaidStudents ?? 0)
  const paidPercent = paymentTotal > 0 ? Math.round(((report?.overview.paidStudents ?? 0) / paymentTotal) * 100) : 0

  const handleExport = async (format: "pdf" | "excel") => {
    setExporting(format)
    try {
      const response = await fetch(`/api/reports/overview/export?format=${format}&${buildQuery()}`, {
        credentials: "include",
      })
      if (!response.ok) throw new Error("Export failed")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download =
        format === "pdf"
          ? `admin-report-${new Date().toISOString().slice(0, 10)}.pdf`
          : `admin-report-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#2060AC]/10 via-background to-[#FCBE1A]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#2060AC]/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[#FCBE1A]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full bg-background/80 border-primary/20 text-primary font-medium">
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                Admin Command Center
              </Badge>
              {!loading && report && (
                <Badge variant="outline" className="rounded-full border-emerald-200 text-emerald-700 bg-emerald-50">
                  {paidPercent}% students paid
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Reports & System Overview</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
              Full school overview — students, attendance, all money (fees, teachers, partners, staff), unpaid students, visit scheduled, and every transaction.
            </p>
          </div>
          <div className="flex w-full lg:w-auto flex-wrap gap-2 shrink-0">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full gap-2 px-5 bg-background/80"
              onClick={() => void handleExport("pdf")}
              disabled={loading || exporting !== null || Boolean(error)}
            >
              <Download className="w-4 h-4" />
              {exporting === "pdf" ? "Preparing..." : "Export PDF"}
            </Button>
            <Button
              size="lg"
              className="rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-5"
              onClick={() => void handleExport("excel")}
              disabled={loading || exporting !== null || Boolean(error)}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exporting === "excel" ? "Preparing..." : "Export Excel"}
            </Button>
          </div>
        </div>
      </div>

      <Card className="p-4 sm:p-5 border-muted/50">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="w-4 h-4" />
            Report period
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
            <div className="space-y-1.5">
              <FormLabel className="text-xs">Quick period</FormLabel>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={period}
                disabled={Boolean(month.trim())}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="3m">Last 3 months</option>
                <option value="6m">Last 6 months</option>
                <option value="1y">Last 12 months</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <FormLabel className="text-xs">Specific month (YYYY-MM)</FormLabel>
              <Input
                placeholder="2026-07"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2">
              <Button variant="outline" className="gap-2" onClick={() => void fetchReport()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {report && (
                <Badge variant="outline" className="h-10 px-3 flex items-center">
                  {report.range.label} · {formatDate(report.range.from)} – {formatDate(report.range.to)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 border-dashed flex flex-col items-center justify-center gap-4 text-muted-foreground bg-muted/5">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading system report...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive border-destructive/20 bg-destructive/5">{error}</Card>
      ) : report ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
            <MetricCard
              label="Total Students"
              value={report.overview.totalStudents.toLocaleString()}
              hint={`${report.overview.enrolledStudents} enrolled · ${report.overview.visitScheduledStudents} visit scheduled`}
              icon={Users}
              accent="from-[#2060AC]/15 to-[#2060AC]/5"
              iconBg="bg-[#2060AC]"
            />
            <MetricCard
              label="Unpaid Students"
              value={report.overview.unpaidStudents.toLocaleString()}
              hint={`${report.overview.paidStudents} paid this cycle`}
              icon={Wallet}
              accent="from-rose-500/15 to-rose-500/5"
              iconBg="bg-rose-600"
            />
            <MetricCard
              label="Teachers & Classes"
              value={`${report.overview.totalTeachers} / ${report.overview.totalClasses}`}
              hint="Active teachers and classes"
              icon={GraduationCap}
              accent="from-[#FCBE1A]/15 to-[#FCBE1A]/5"
              iconBg="bg-[#FCBE1A]"
            />
            <MetricCard
              label="Attendance Rate"
              value={`${report.overview.attendanceRate.toFixed(1)}%`}
              hint="Last 7 days average"
              icon={Calendar}
              accent="from-emerald-500/15 to-emerald-500/5"
              iconBg="bg-emerald-600"
            />
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="money">Money</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="payroll">Payroll & Partners</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Student Enrollment" description="New registrations over the last 6 months" icon={TrendingUp}>
                  {enrollmentData.length === 0 ? (
                    <EmptyChart message="No enrollment data yet" />
                  ) : (
                    <ChartContainer config={enrollmentChartConfig} className="h-[280px] w-full">
                      <BarChart data={enrollmentData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/50" />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis tickLine={false} axisLine={false} fontSize={12} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="students" fill="var(--color-students)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </ChartCard>

                <ChartCard title="Weekly Attendance" description="Present vs absent students this week" icon={Calendar}>
                  {attendanceData.length === 0 ? (
                    <EmptyChart message="No attendance data yet" />
                  ) : (
                    <ChartContainer config={attendanceChartConfig} className="h-[280px] w-full">
                      <BarChart data={attendanceData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/50" />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis tickLine={false} axisLine={false} fontSize={12} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="present" fill="var(--color-present)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                        <Bar dataKey="absent" fill="var(--color-absent)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </ChartCard>
              </div>

              <Card className="border-muted/50 shadow-sm overflow-hidden">
                <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base text-foreground tracking-tight">Payment Status</h3>
                    <p className="text-sm text-muted-foreground">Paid vs unpaid enrolled students</p>
                  </div>
                  <div className="shrink-0 p-2.5 rounded-xl bg-primary/8 text-primary">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
                <div className="px-6 pb-6 pt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-5 space-y-4">
                    <MoneyTile label="Student Fees This Month" value={formatMoney(report.money.studentFeesThisMonth)} tone="accent" />
                    <div className="grid grid-cols-2 gap-4">
                      <MoneyTile label="Paid" value={String(report.overview.paidStudents)} tone="income" />
                      <MoneyTile label="Unpaid" value={String(report.overview.unpaidStudents)} tone="expense" />
                    </div>
                  </div>
                  <div className="lg:col-span-7">
                    {paymentTotal === 0 ? (
                      <EmptyChart message="No payment data yet" />
                    ) : (
                      <ChartContainer config={paymentChartConfig} className="mx-auto h-[260px] w-full max-w-[420px]">
                        <PieChart>
                          <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="status" />} />
                          <Pie
                            data={paymentData}
                            dataKey="count"
                            nameKey="status"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={4}
                            strokeWidth={0}
                          >
                            {paymentData.map((entry) => (
                              <Cell key={entry.status} fill={entry.fill} />
                            ))}
                            <Label
                              content={({ viewBox }) => {
                                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                  return (
                                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                      <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 8} className="fill-foreground text-2xl font-bold">
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
                          <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                        </PieChart>
                      </ChartContainer>
                    )}
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="money" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MoneyTile label="Total Income (Period)" value={formatMoney(report.money.totalIncomePeriod)} tone="income" />
                <MoneyTile label="Total Expenses (Period)" value={formatMoney(report.money.totalExpensesPeriod)} tone="expense" />
                <MoneyTile label="Net Balance (Period)" value={formatMoney(report.money.netBalancePeriod)} tone="accent" />
                <MoneyTile label="Student Fees All Time" value={formatMoney(report.money.studentFeesAllTime)} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-5 space-y-4">
                  <h3 className="font-semibold">Period Breakdown</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Student fees</span><span className="font-medium">{formatMoney(report.money.studentFeesPeriod)}</span></div>
                    <div className="flex justify-between"><span>Teacher payouts</span><span className="font-medium">{formatMoney(report.money.teacherPayoutsPeriod)}</span></div>
                    <div className="flex justify-between"><span>Partner payouts</span><span className="font-medium">{formatMoney(report.money.partnerPayoutsPeriod)}</span></div>
                    <div className="flex justify-between"><span>Staff salaries</span><span className="font-medium">{formatMoney(report.money.staffPayoutsPeriod)}</span></div>
                    <div className="flex justify-between"><span>Manual income</span><span className="font-medium text-emerald-700">{formatMoney(report.money.manualIncomePeriod)}</span></div>
                    <div className="flex justify-between"><span>Manual expenses</span><span className="font-medium text-rose-700">{formatMoney(report.money.manualExpensePeriod)}</span></div>
                  </div>
                </Card>

                <Card className="p-5 space-y-4">
                  <h3 className="font-semibold">This Month Payouts</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Student fees collected</span><span className="font-medium">{formatMoney(report.money.studentFeesThisMonth)}</span></div>
                    <div className="flex justify-between"><span>Teacher payouts</span><span className="font-medium">{formatMoney(report.money.teacherPayoutsThisMonth)}</span></div>
                    <div className="flex justify-between"><span>Partner payouts</span><span className="font-medium">{formatMoney(report.money.partnerPayoutsThisMonth)}</span></div>
                    <div className="flex justify-between"><span>Staff salaries</span><span className="font-medium">{formatMoney(report.money.staffPayoutsThisMonth)}</span></div>
                  </div>
                  <div className="border-t pt-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>Outstanding — Teachers</span><span className="font-semibold">{formatMoney(report.money.teacherBalanceDue)}</span></div>
                    <div className="flex justify-between"><span>Outstanding — Partners</span><span className="font-semibold">{formatMoney(report.money.partnerBalanceDue)}</span></div>
                    <div className="flex justify-between"><span>Outstanding — Staff</span><span className="font-semibold">{formatMoney(report.money.staffBalanceDue)}</span></div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="students" className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="overflow-hidden">
                  <div className="px-6 py-4 border-b">
                    <h3 className="font-semibold">Unpaid Students ({report.unpaidStudents.length})</h3>
                    <p className="text-sm text-muted-foreground">Enrolled but payment not received</p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Phone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.unpaidStudents.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-muted-foreground">No unpaid students</TableCell></TableRow>
                        ) : (
                          report.unpaidStudents.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell>{row.className ?? "—"}</TableCell>
                              <TableCell>{row.phone ?? "—"}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                <Card className="overflow-hidden">
                  <div className="px-6 py-4 border-b">
                    <h3 className="font-semibold">Visit Scheduled ({report.visitScheduled.length})</h3>
                    <p className="text-sm text-muted-foreground">Students waiting for school visit</p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Visit Date</TableHead>
                          <TableHead>Phone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.visitScheduled.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-muted-foreground">No visit scheduled</TableCell></TableRow>
                        ) : (
                          report.visitScheduled.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell>{formatDate(row.visitDate)}</TableCell>
                              <TableCell>{row.phone ?? "—"}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="attendance" className="space-y-6">
              <Card className="overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold">Attendance By Class</h3>
                  <p className="text-sm text-muted-foreground">For selected report period · sorted by highest absence rate</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead className="text-right">Present</TableHead>
                        <TableHead className="text-right">Absent</TableHead>
                        <TableHead className="text-right">Absent Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.attendanceByClass.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-muted-foreground">No attendance records in this period</TableCell></TableRow>
                      ) : (
                        report.attendanceByClass.map((row) => (
                          <TableRow key={row.classId}>
                            <TableCell className="font-medium">{row.className}</TableCell>
                            <TableCell className="text-right">{row.present}</TableCell>
                            <TableCell className="text-right">{row.absent}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={row.absentRate >= 30 ? "destructive" : "secondary"}>{row.absentRate}%</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="payroll" className="space-y-6">
              <Card className="overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold">Teachers</h3>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Monthly Pay</TableHead>
                        <TableHead className="text-right">Paid Out</TableHead>
                        <TableHead className="text-right">Balance Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.payroll.teachers.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.monthlyPay)}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.totalPaidOut)}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.balanceDue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="overflow-hidden">
                  <div className="px-6 py-4 border-b"><h3 className="font-semibold">Partners</h3></div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Monthly Due</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.payroll.partners.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-right">{formatMoney(row.monthlyDue)}</TableCell>
                            <TableCell className="text-right">{formatMoney(row.balanceDue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                <Card className="overflow-hidden">
                  <div className="px-6 py-4 border-b"><h3 className="font-semibold">Staff Salaries</h3></div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Job</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.payroll.staff.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.jobTitle ?? "—"}</TableCell>
                            <TableCell className="text-right">{formatMoney(row.balanceDue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MoneyTile label="Income" value={formatMoney(report.transactionTotals.totalIncome)} tone="income" />
                <MoneyTile label="Expenses" value={formatMoney(report.transactionTotals.totalExpenses)} tone="expense" />
                <MoneyTile label="Net" value={formatMoney(report.transactionTotals.netBalance)} tone="accent" />
              </div>

              <Card className="overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">All Transactions</h3>
                    <p className="text-sm text-muted-foreground">{report.transactionTotals.transactionCount} records in period</p>
                  </div>
                  <Badge variant="outline">{report.range.label}</Badge>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.transactions.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-muted-foreground">No transactions in this period</TableCell></TableRow>
                      ) : (
                        report.transactions.map((row, index) => (
                          <TableRow key={`${row.date}-${row.name}-${index}`}>
                            <TableCell>{formatDate(row.date)}</TableCell>
                            <TableCell>{row.category}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="max-w-[240px] truncate">{row.description}</TableCell>
                            <TableCell className={`text-right font-medium ${row.direction === "income" ? "text-emerald-700" : "text-rose-700"}`}>
                              {row.direction === "income" ? "+" : "−"}{formatMoney(row.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
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
