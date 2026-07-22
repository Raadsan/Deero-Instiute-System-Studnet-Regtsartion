"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, FileSpreadsheet, Filter, RefreshCw } from "lucide-react"

import { api } from "@/lib/api"
import { formatMoney } from "@/lib/finance-utils"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ReportOptions = {
  classes: Array<{ id: string; name: string; level: string | null }>
  teachers: Array<{ id: string; name: string; email: string }>
  partners: Array<{ id: string; name: string }>
  staff: Array<{ id: string; name: string; jobTitle: string | null }>
  students: Array<{ id: string; name: string; className: string | null }>
}

type ReportData = {
  range: { from: string; to: string; label: string }
  filters: { category: string; entityId: string | null }
  totals: { totalIncome: number; totalExpenses: number; netBalance: number; transactionCount: number }
  lines: Array<{
    date: string
    category: string
    name: string
    description: string
    amount: number
    direction: "income" | "expense"
  }>
}

const ALL = "__all__"

function getErrorMessage(error: unknown) {
  const err = error as { response?: { data?: { message?: string } }; message?: string }
  return err?.response?.data?.message ?? err?.message ?? "Something went wrong."
}

export default function FinanceReports() {
  const [options, setOptions] = useState<ReportOptions | null>(null)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null)

  const [period, setPeriod] = useState("3m")
  const [month, setMonth] = useState("")
  const [category, setCategory] = useState("all")
  const [entityId, setEntityId] = useState(ALL)

  const entityChoices = useMemo(() => {
    if (!options) return []
    if (category === "classes") return options.classes.map((row) => ({ id: row.id, label: row.name }))
    if (category === "teachers") return options.teachers.map((row) => ({ id: row.id, label: row.name }))
    if (category === "partners") return options.partners.map((row) => ({ id: row.id, label: row.name }))
    if (category === "staff") return options.staff.map((row) => ({ id: row.id, label: row.name }))
    if (category === "students") return options.students.map((row) => ({ id: row.id, label: row.name }))
    return []
  }, [options, category])

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (month.trim()) params.set("month", month.trim())
    else params.set("period", period)
    params.set("category", category)
    if (entityId !== ALL) params.set("entityId", entityId)
    return params.toString()
  }, [period, month, category, entityId])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const query = buildQuery()
      const res = await api.get<ReportData>(`/api/finance/reports?${query}`)
      setReport(res.data)
    } catch (e: unknown) {
      toast({ title: "Failed to load report", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<ReportOptions>("/api/finance/reports?options=true")
        setOptions(res.data)
      } catch (e: unknown) {
        toast({ title: "Failed to load filters", description: getErrorMessage(e), variant: "destructive" })
      }
    })()
  }, [])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  const handleExport = async (format: "pdf" | "excel") => {
    setExporting(format)
    try {
      const query = buildQuery()
      const response = await fetch(`/api/finance/reports/export?format=${format}&${query}`, {
        credentials: "include",
      })
      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download =
        format === "pdf"
          ? `finance-report-${new Date().toISOString().slice(0, 10)}.pdf`
          : `finance-report-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast({ title: format === "pdf" ? "PDF downloaded" : "Excel file downloaded" })
    } catch (e: unknown) {
      toast({ title: "Export failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Filter by period and person, then export to PDF or Excel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void fetchReport()} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
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

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Report Filters</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="grid gap-2">
            <Label>Period</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value)
                setMonth("")
              }}
            >
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
              <option value="1y">Last 1 year</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Specific month (optional)</Label>
            <Input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              placeholder="2026-07"
            />
          </div>

          <div className="grid gap-2">
            <Label>Category</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                setEntityId(ALL)
              }}
            >
              <option value="all">All transactions</option>
              <option value="students">Student fees</option>
              <option value="classes">By class</option>
              <option value="teachers">Teacher payroll</option>
              <option value="partners">Partner payouts</option>
              <option value="staff">Staff salaries</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Person / Class</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
              disabled={category === "all" || entityChoices.length === 0}
            >
              <option value={ALL}>All in category</option>
              {entityChoices.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !report ? (
        <Card className="p-6 text-center text-muted-foreground">No report data available.</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-emerald-600">{formatMoney(report.totals.totalIncome)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">{formatMoney(report.totals.totalExpenses)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Net Balance</p>
              <p className={`text-2xl font-bold ${report.totals.netBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatMoney(report.totals.netBalance)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="text-2xl font-bold">{report.totals.transactionCount}</p>
            </Card>
          </div>

          <Card className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant="outline">Period: {report.range.label}</Badge>
              <Badge variant="secondary">Category: {report.filters.category}</Badge>
              {report.filters.entityId && <Badge variant="secondary">Filtered entity</Badge>}
            </div>

            {report.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No transactions found for these filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.lines.map((line, index) => (
                      <TableRow key={`${line.date}-${index}`}>
                        <TableCell>{new Date(line.date).toLocaleDateString()}</TableCell>
                        <TableCell>{line.category}</TableCell>
                        <TableCell className="font-medium">{line.name}</TableCell>
                        <TableCell>{line.description || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={line.direction === "income" ? "default" : "destructive"}>
                            {line.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(line.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
