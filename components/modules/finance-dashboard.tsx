"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Users,
  GraduationCap,
  Handshake,
  Briefcase,
  ArrowRight,
  Download,
  FileSpreadsheet,
} from "lucide-react"

import { api } from "@/lib/api"
import { downloadExportFile } from "@/lib/export-client"
import { formatMoney } from "@/lib/finance-utils"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type FinanceSummary = {
  overview: {
    totalIncome: number
    incomeThisMonth: number
    manualIncome: number
    manualExpenses: number
    totalExpenses: number
    netBalance: number
    outstandingPayables: number
    unpaidStudents: number
  }
  studentFees: { totalCollected: number; monthlyCollected: number; unpaidStudents: number }
  partners: { monthlyDue: number; balanceDue: number; totalPaidOut: number; count: number }
  teacherPayroll: { monthlyPay: number; balanceDue: number; totalPaidOut: number; teachersCount: number }
}

const quickLinks = [
  { href: "/finance/student-fees", label: "Student Fees", icon: GraduationCap },
  { href: "/finance/teacher-payroll", label: "Teacher Payroll", icon: Users },
  { href: "/finance/partners", label: "Partner Payouts", icon: Handshake },
  { href: "/finance/expenses", label: "Income & Expenses", icon: TrendingDown },
  { href: "/finance/reports", label: "Financial Reports", icon: DollarSign },
]

export default function FinanceDashboard() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null)

  const handleExport = async (format: "pdf" | "excel") => {
    setExporting(format)
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      await downloadExportFile(
        `/api/finance/summary/export?format=${format}`,
        format === "pdf" ? `finance-dashboard-${stamp}.pdf` : `finance-dashboard-${stamp}.csv`,
      )
      toast({ title: format === "pdf" ? "PDF downloaded" : "Excel file downloaded" })
    } catch (e: unknown) {
      const err = e as { message?: string }
      toast({ title: "Export failed", description: err.message ?? "Something went wrong.", variant: "destructive" })
    } finally {
      setExporting(null)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<FinanceSummary>("/api/finance/summary")
        setSummary(res.data)
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } }; message?: string }
        setError(err?.response?.data?.message ?? err?.message ?? "Failed to load finance summary")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error || !summary) {
    return <div className="p-6 text-center text-destructive">{error ?? "Unable to load finance dashboard"}</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track revenue, expenses, payroll, partner balances, and outstanding payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleExport("pdf")} disabled={Boolean(exporting)}>
            <Download className="h-4 w-4 mr-2" />
            {exporting === "pdf" ? "Exporting..." : "Export PDF"}
          </Button>
          <Button onClick={() => void handleExport("excel")} disabled={Boolean(exporting)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {exporting === "excel" ? "Exporting..." : "Export Excel"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold">{formatMoney(summary.overview.totalIncome)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Income This Month</p>
              <p className="text-2xl font-bold">{formatMoney(summary.overview.incomeThisMonth)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/10 p-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold">{formatMoney(summary.overview.totalExpenses)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding Payables</p>
              <p className="text-2xl font-bold">{formatMoney(summary.overview.outstandingPayables)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Revenue & Balances</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Student fees collected</span><span className="font-medium">{formatMoney(summary.studentFees.totalCollected)}</span></div>
            <div className="flex justify-between"><span>Student fees this month</span><span className="font-medium">{formatMoney(summary.studentFees.monthlyCollected)}</span></div>
            <div className="flex justify-between"><span>Unpaid students</span><span className="font-medium">{summary.studentFees.unpaidStudents}</span></div>
            <div className="flex justify-between"><span>Other income entries</span><span className="font-medium">{formatMoney(summary.overview.manualIncome)}</span></div>
            <div className="flex justify-between"><span>Manual expenses</span><span className="font-medium">{formatMoney(summary.overview.manualExpenses)}</span></div>
            <div className="flex justify-between border-t pt-2"><span>Net balance</span><span className="font-semibold">{formatMoney(summary.overview.netBalance)}</span></div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Monthly Payroll & Partners</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Teacher payroll due</span><span className="font-medium">{formatMoney(summary.teacherPayroll.monthlyPay)}</span></div>
            <div className="flex justify-between"><span>Teacher balance outstanding</span><span className="font-medium">{formatMoney(summary.teacherPayroll.balanceDue)}</span></div>
            <div className="flex justify-between"><span>Partner monthly due</span><span className="font-medium">{formatMoney(summary.partners.monthlyDue)}</span></div>
            <div className="flex justify-between border-t pt-2"><span>Partner balance outstanding</span><span className="font-semibold">{formatMoney(summary.partners.balanceDue)}</span></div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-4">Finance Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link key={link.href} href={link.href} className="rounded-lg border p-4 hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-medium">{link.label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            )
          })}
        </div>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/finance/reports">Open Full Financial Report</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
