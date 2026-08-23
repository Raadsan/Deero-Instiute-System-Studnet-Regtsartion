"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Plus,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Users,
  GraduationCap,
  Search,
  Receipt,
} from "lucide-react"

import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ClassOption = { id: string; name: string; level: string | null }
type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID"
type ClassSummary = {
  classId: string | null
  className: string
  totalCollected: number
  paymentCount: number
  paidStudents: number
  partialStudents: number
  unpaidStudents: number
  totalStudents: number
  totalFees: number
  outstandingBalance: number
  creditBalance: number
}
type StudentLedger = {
  id: string
  firstName: string
  lastName: string
  paymentStatus: PaymentStatus
  class: ClassOption | null
  feeAmount: number
  totalPaid: number
  remainingBalance: number
  creditBalance: number
  paymentCount: number
  lastPaidAt: string | null
}
type RecordedByInfo = {
  id: string
  name: string
  email: string
  role: string
} | null

type PaymentRow = {
  id: string
  amount: number
  currency: string
  paidAt: string
  note: string | null
  recordedBy: RecordedByInfo
  student: {
    id: string
    firstName: string
    lastName: string
    paymentStatus: PaymentStatus
    class: ClassOption | null
  } | null
}
type PaymentsSummary = {
  totals: {
    totalCollected: number
    monthlyCollected: number
    paymentCount: number
    paidStudents: number
    partialStudents: number
    unpaidStudents: number
    outstandingStudents: number
    totalStudents: number
    totalFees: number
    outstandingBalance: number
    creditBalance: number
  }
  byClass: ClassSummary[]
  studentLedgers: StudentLedger[]
  recentPayments: PaymentRow[]
  classes: ClassOption[]
}

const ALL_CLASSES = "__all__"
const ALL_STATUSES = "__all__"
const selectContentClass = "z-[200] bg-background border shadow-xl"

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value)
}

function paymentStatusLabel(status: PaymentStatus) {
  if (status === "PAID") return "Paid"
  if (status === "PARTIAL") return "Partial"
  return "Unpaid"
}

function paymentStatusClass(status: PaymentStatus) {
  if (status === "PAID") return "rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
  if (status === "PARTIAL") return "rounded-full bg-blue-50 text-blue-700 border border-blue-200"
  return "rounded-full bg-amber-50 text-amber-700 border border-amber-200"
}

function formatPersonName(firstName: string, lastName: string) {
  const format = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  return `${format(firstName)} ${format(lastName)}`.trim()
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export default function PaymentsView() {
  const [summary, setSummary] = useState<PaymentsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [classFilter, setClassFilter] = useState(ALL_CLASSES)
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES)
  const [search, setSearch] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [studentSearch, setStudentSearch] = useState("")
  const [feeAmount, setFeeAmount] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (classFilter !== ALL_CLASSES) params.set("classId", classFilter)
      if (statusFilter !== ALL_STATUSES) params.set("paymentStatus", statusFilter)
      const res = await api.get<PaymentsSummary>(`/api/payments/summary?${params.toString()}`)
      setSummary(res.data)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [classFilter, statusFilter])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const filteredLedgers = useMemo(() => {
    const rows = summary?.studentLedgers ?? []
    if (!search.trim()) return rows
    const term = search.toLowerCase()
    return rows.filter((s) => {
      const fullName = `${s.firstName} ${s.lastName}`.toLowerCase()
      const className = s.class?.name?.toLowerCase() ?? ""
      return fullName.includes(term) || className.includes(term)
    })
  }, [summary?.studentLedgers, search])

  const outstandingStudents = useMemo(
    () => filteredLedgers.filter((s) => s.paymentStatus !== "PAID"),
    [filteredLedgers],
  )

  const filteredClassRows = useMemo(() => {
    const rows = summary?.byClass ?? []
    if (classFilter === ALL_CLASSES) return rows
    return rows.filter((row) => row.classId === classFilter)
  }, [summary?.byClass, classFilter])

  const dialogStudents = useMemo(() => {
    return (summary?.studentLedgers ?? []).filter((s) => s.paymentStatus !== "PAID")
  }, [summary?.studentLedgers])

  const filteredDialogStudents = useMemo(() => {
    if (!studentSearch.trim()) return dialogStudents
    const term = studentSearch.toLowerCase()
    return dialogStudents.filter((s) => {
      const fullName = `${s.firstName} ${s.lastName}`.toLowerCase()
      const className = s.class?.name?.toLowerCase() ?? ""
      return fullName.includes(term) || className.includes(term)
    })
  }, [dialogStudents, studentSearch])

  const selectedStudent = useMemo(
    () => summary?.studentLedgers.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, summary?.studentLedgers],
  )

  const openDialog = (studentId?: string) => {
    const student = studentId ? summary?.studentLedgers.find((row) => row.id === studentId) : null
    setDialogOpen(true)
    setSelectedStudentId(studentId ?? "")
    setFeeAmount(student?.feeAmount ? String(student.feeAmount) : "")
    setAmount("")
    setNote("")
    setStudentSearch("")
  }

  const selectDialogStudent = (studentId: string) => {
    const student = summary?.studentLedgers.find((row) => row.id === studentId)
    setSelectedStudentId(studentId)
    setFeeAmount(student?.feeAmount ? String(student.feeAmount) : "")
  }

  const submitPayment = async () => {
    if (!selectedStudentId) {
      toast({ title: "Select a student", variant: "destructive" })
      return
    }
    const numericAmount = amount.trim() ? Number(amount) : 0
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
      return
    }
    const numericFeeAmount = Number(feeAmount)
    if (!Number.isFinite(numericFeeAmount) || numericFeeAmount <= 0) {
      toast({ title: "Enter the total fee", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const res = numericAmount > 0
        ? await api.post("/api/payments", {
            studentId: selectedStudentId,
            amount: numericAmount,
            feeAmount: numericFeeAmount,
            note: note.trim() ? note.trim() : null,
          })
        : await api.patch("/api/payments", {
            studentId: selectedStudentId,
            feeAmount: numericFeeAmount,
          })
      toast({
        title: numericAmount > 0 ? "Payment recorded" : "Total fee saved",
        description:
          res.data.remainingBalance > 0
            ? `${formatCurrency(res.data.remainingBalance)} remaining.`
            : res.data.creditBalance > 0
              ? `${formatCurrency(res.data.creditBalance)} credit on the account.`
              : "The fee is fully paid.",
      })
      setDialogOpen(false)
      await fetchData()
    } catch (e: any) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const totals = summary?.totals

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#003D9E]/10 via-background to-[#EC4724]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#003D9E]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/15 px-3 py-1 text-xs font-medium text-primary">
                <DollarSign className="w-3.5 h-3.5" />
                {totals?.paymentCount ?? 0} payment{(totals?.paymentCount ?? 0) === 1 ? "" : "s"}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700">
                {totals?.outstandingStudents ?? 0} owing a balance
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Payments & Fees</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Track student fees by class, see who paid, and record new payments.
            </p>
          </div>
          <Button
            onClick={() => openDialog()}
            size="lg"
            className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6 shrink-0"
          >
            <Plus className="w-5 h-5" /> Record Payment
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-5 border-muted/50 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Filter by class</Label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-11 bg-background">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent className={selectContentClass} position="popper">
                <SelectItem value={ALL_CLASSES}>All classes</SelectItem>
                {(summary?.classes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Payment status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 bg-background">
                <SelectValue placeholder="All students" />
              </SelectTrigger>
              <SelectContent className={selectContentClass} position="popper">
                <SelectItem value={ALL_STATUSES}>All students</SelectItem>
                <SelectItem value="PAID">Paid only</SelectItem>
                <SelectItem value="PARTIAL">Partial only</SelectItem>
                <SelectItem value="UNPAID">Unpaid only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Search student</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or class..."
                className="h-11 pl-9 bg-background"
              />
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading payments...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm bg-destructive/5 text-destructive border-destructive/20 shadow-sm">{error}</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <Card className="relative overflow-hidden p-5 border-muted/50 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-[#003D9E]" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Collected</p>
              <p className="text-2xl sm:text-3xl font-bold text-[#003D9E] tabular-nums mt-1">
                {formatCurrency(totals?.totalCollected ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">All recorded payments</p>
            </Card>
            <Card className="relative overflow-hidden p-5 border-muted/50 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-[#EC4724]" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding Balance</p>
              <p className="text-2xl sm:text-3xl font-bold text-[#EC4724] tabular-nums mt-1">
                {formatCurrency(totals?.outstandingBalance ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Still owed by students</p>
            </Card>
            <Card className="relative overflow-hidden p-5 border-muted/50 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This Month</p>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums mt-1">
                {formatCurrency(totals?.monthlyCollected ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Monthly revenue</p>
            </Card>
            <Card className="relative overflow-hidden p-5 border-muted/50 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500/70" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paid Students</p>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums mt-1">{totals?.paidStudents ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Out of {totals?.totalStudents ?? 0} students</p>
            </Card>
            <Card className="relative overflow-hidden p-5 border-muted/50 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-[#EC4724]" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding Students</p>
              <p className="text-2xl sm:text-3xl font-bold text-[#EC4724] tabular-nums mt-1">{totals?.outstandingStudents ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{totals?.partialStudents ?? 0} partial / {totals?.unpaidStudents ?? 0} unpaid</p>
            </Card>
          </div>

          <div className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b bg-muted/20 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-lg font-bold tracking-tight">Revenue by Class</h2>
                <p className="text-sm text-muted-foreground">Total fees collected per class</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Class</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Students</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Paid</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Partial</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Unpaid</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Payments</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Collected</TableHead>
                    <TableHead className="pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClassRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground text-sm">
                        No class payment data yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClassRows.map((row) => (
                      <TableRow key={row.classId ?? "none"} className="hover:bg-muted/40">
                        <TableCell className="pl-6 py-4 font-semibold">{row.className}</TableCell>
                        <TableCell className="py-4">{row.totalStudents}</TableCell>
                        <TableCell className="py-4 text-emerald-700 font-medium">{row.paidStudents}</TableCell>
                        <TableCell className="py-4 text-blue-700 font-medium">{row.partialStudents}</TableCell>
                        <TableCell className="py-4 text-amber-700 font-medium">{row.unpaidStudents}</TableCell>
                        <TableCell className="py-4">{row.paymentCount}</TableCell>
                        <TableCell className="py-4 text-right font-bold tabular-nums text-[#003D9E]">
                          {formatCurrency(row.totalCollected)}
                        </TableCell>
                        <TableCell className="py-4 pr-6 text-right font-bold tabular-nums text-[#EC4724]">
                          {formatCurrency(row.outstandingBalance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <Tabs defaultValue="students" className="space-y-4">
            <TabsList className="grid w-full max-w-xl grid-cols-3 h-11">
              <TabsTrigger value="students" className="gap-1.5">
                <Users className="w-4 h-4" />
                Students
              </TabsTrigger>
              <TabsTrigger value="unpaid" className="gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Outstanding ({outstandingStudents.length})
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-1.5">
                <Receipt className="w-4 h-4" />
                Transactions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="students">
              <div className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b bg-muted/20">
                  <h2 className="text-lg font-bold tracking-tight">Student Payment Accounts</h2>
                  <p className="text-sm text-muted-foreground">Total fee, payments received, and the exact balance for every student</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6 min-w-[180px]">Student</TableHead>
                        <TableHead className="hidden md:table-cell">Class</TableHead>
                        <TableHead>Total Fee</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="pr-6 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLedgers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-muted-foreground text-sm">
                            No students match your filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLedgers.map((student) => (
                          <TableRow key={student.id} className="hover:bg-muted/40">
                            <TableCell className="pl-6 py-4 font-semibold">
                              {formatPersonName(student.firstName, student.lastName)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell py-4">
                              {student.class?.name ? (
                                <Badge variant="outline" className="rounded-full capitalize">
                                  {student.class.name}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="py-4 tabular-nums">{formatCurrency(student.feeAmount)}</TableCell>
                            <TableCell className="py-4 font-semibold tabular-nums text-[#003D9E]">{formatCurrency(student.totalPaid)}</TableCell>
                            <TableCell className="py-4 font-semibold tabular-nums">
                              {student.creditBalance > 0 ? (
                                <span className="text-emerald-700">Credit {formatCurrency(student.creditBalance)}</span>
                              ) : (
                                <span className={student.remainingBalance > 0 ? "text-[#EC4724]" : "text-emerald-700"}>
                                  {formatCurrency(student.remainingBalance)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-4 text-center">
                              <Badge className={paymentStatusClass(student.paymentStatus)}>
                                {paymentStatusLabel(student.paymentStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4 pr-6 text-right">
                              {student.paymentStatus !== "PAID" && (
                                <Button size="sm" variant="outline" className="rounded-full" onClick={() => openDialog(student.id)}>
                                  {student.feeAmount > 0 ? "Record" : "Set Fee"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="unpaid">
              <div className="rounded-xl border border-amber-200/60 bg-card shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b bg-amber-50/50">
                  <h2 className="text-lg font-bold tracking-tight text-amber-900">Outstanding Student Balances</h2>
                  <p className="text-sm text-muted-foreground">
                    Students who still owe all or part of their fee{classFilter !== ALL_CLASSES ? " in this class" : ""}.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">Student</TableHead>
                        <TableHead className="hidden md:table-cell">Class</TableHead>
                        <TableHead>Total Fee</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="pr-6 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outstandingStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-muted-foreground text-sm">
                            No outstanding student balances in this filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        outstandingStudents.map((student) => (
                          <TableRow key={student.id} className="hover:bg-muted/40">
                            <TableCell className="pl-6 py-4 font-semibold">
                              {formatPersonName(student.firstName, student.lastName)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell py-4 capitalize">{student.class?.name ?? "—"}</TableCell>
                            <TableCell className="py-4 tabular-nums">{formatCurrency(student.feeAmount)}</TableCell>
                            <TableCell className="py-4 font-semibold tabular-nums text-[#003D9E]">{formatCurrency(student.totalPaid)}</TableCell>
                            <TableCell className="py-4 font-bold tabular-nums text-[#EC4724]">{formatCurrency(student.remainingBalance)}</TableCell>
                            <TableCell className="py-4 text-center">
                              <Badge className={paymentStatusClass(student.paymentStatus)}>{paymentStatusLabel(student.paymentStatus)}</Badge>
                            </TableCell>
                            <TableCell className="py-4 pr-6 text-right">
                              <Button size="sm" className="rounded-full" onClick={() => openDialog(student.id)}>
                                {student.feeAmount > 0 ? "Record Payment" : "Set Total Fee"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="transactions">
              <div className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b bg-muted/20 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">Payment Transactions</h2>
                    <p className="text-sm text-muted-foreground">All fee payments recorded in the system</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6 min-w-[180px]">Student</TableHead>
                        <TableHead className="hidden md:table-cell">Class</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead className="hidden lg:table-cell">Note</TableHead>
                        <TableHead className="hidden xl:table-cell">Recorded By</TableHead>
                        <TableHead className="pr-6 text-center">Account Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(summary?.recentPayments ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-muted-foreground text-sm">
                            No payments recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        summary?.recentPayments.map((payment) => (
                          <TableRow key={payment.id} className="hover:bg-muted/40">
                            <TableCell className="pl-6 py-4 font-semibold">
                              {payment.student
                                ? formatPersonName(payment.student.firstName, payment.student.lastName)
                                : "—"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell py-4 capitalize">
                              {payment.student?.class?.name ?? "—"}
                            </TableCell>
                            <TableCell className="py-4 font-semibold tabular-nums">
                              {formatCurrency(payment.amount, payment.currency)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell py-4 text-sm text-muted-foreground">
                              {formatDate(payment.paidAt)}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell py-4 text-sm text-muted-foreground max-w-[200px] truncate">
                              {payment.note ?? "—"}
                            </TableCell>
                            <TableCell className="hidden xl:table-cell py-4 text-sm text-muted-foreground">
                              {payment.recordedBy?.name ?? "Unknown"}
                            </TableCell>
                            <TableCell className="py-4 pr-6 text-center">
                              {payment.student ? (
                                <Badge className={paymentStatusClass(payment.student.paymentStatus)}>
                                  {paymentStatusLabel(payment.student.paymentStatus)}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Enter the total fee and, when money is received, the installment amount. The remaining balance is calculated automatically.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={selectedStudentId} onValueChange={selectDialogStudent}>
                <SelectTrigger className="w-full h-11 bg-background">
                  <SelectValue placeholder="Select student with a balance" />
                </SelectTrigger>
                <SelectContent className={selectContentClass} position="popper">
                  <div className="px-2 pt-2 pb-1 border-b bg-background sticky top-0 z-10">
                    <Input
                      placeholder="Search student..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="h-9 bg-background"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {filteredDialogStudents.length ? (
                    filteredDialogStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatPersonName(s.firstName, s.lastName)}
                        {s.class ? ` · ${s.class.name}` : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">No outstanding students found</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedStudent && (
              <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Fee</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(selectedStudent.feeAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="font-semibold tabular-nums text-[#003D9E]">{formatCurrency(selectedStudent.totalPaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-semibold tabular-nums text-[#EC4724]">{formatCurrency(selectedStudent.remainingBalance)}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feeAmount">Total Fee (USD)</Label>
                <Input
                  id="feeAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="e.g. 55"
                  className="h-11 bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Paid Now (USD) <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50"
                  className="h-11 bg-background"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="note">
                  Note <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. March fee"
                  className="h-11 bg-background"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={saving} className="rounded-full px-6">
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving...
                </>
              ) : (
                amount.trim() ? "Record Payment" : "Save Total Fee"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
