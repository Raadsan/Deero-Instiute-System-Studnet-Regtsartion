"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardList, Search, UserCircle2, Download, FileSpreadsheet } from "lucide-react"

import { api } from "@/lib/api"
import { downloadExportFile } from "@/lib/export-client"
import { formatMoney } from "@/lib/finance-utils"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type AuditEntryType =
  | "STUDENT_PAYMENT"
  | "PARTNER_PAYOUT"
  | "TEACHER_PAYOUT"
  | "STAFF_PAYOUT"
  | "FINANCE_INCOME"
  | "FINANCE_EXPENSE"

type AuditEntry = {
  id: string
  type: AuditEntryType
  description: string
  amount: number
  currency: string
  occurredAt: string
  note: string | null
  recordedBy: { id: string; name: string; email: string; role: string } | null
}

const ALL_TYPES = "__all__"
const selectContentClass = "z-[200] bg-background border shadow-xl"

const TYPE_LABELS: Record<AuditEntryType, string> = {
  STUDENT_PAYMENT: "Student Fee",
  PARTNER_PAYOUT: "Partner Payout",
  TEACHER_PAYOUT: "Teacher Payroll",
  STAFF_PAYOUT: "Staff Salary",
  FINANCE_INCOME: "Income",
  FINANCE_EXPENSE: "Expense",
}

function getErrorMessage(error: unknown) {
  const err = error as { response?: { data?: { message?: string } }; message?: string }
  return err?.response?.data?.message ?? err?.message ?? "Something went wrong."
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function typeBadgeClass(type: AuditEntryType) {
  if (type === "STUDENT_PAYMENT" || type === "FINANCE_INCOME") {
    return "rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
  }
  if (type === "FINANCE_EXPENSE") {
    return "rounded-full bg-rose-50 text-rose-700 border border-rose-200"
  }
  return "rounded-full bg-blue-50 text-blue-700 border border-blue-200"
}

export default function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 })
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES)
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null)

  const fetchAuditLog = useCallback(async (targetPage = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: "50",
      })
      if (typeFilter !== ALL_TYPES) params.set("type", typeFilter)
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim())
      const res = await api.get<{ data: { entries: AuditEntry[]; pagination: typeof pagination } }>(`/api/audit?${params.toString()}`)
      setEntries(res.data.data.entries)
      setPagination(res.data.data.pagination)
      setPage(res.data.data.pagination.page)
    } catch (error) {
      toast({ title: "Failed to load audit log", description: getErrorMessage(error), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [typeFilter, debouncedSearch, page])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 350)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
    void fetchAuditLog(1)
  }, [typeFilter, debouncedSearch])

  const filteredEntries = entries

  const handleExport = async (format: "pdf" | "excel") => {
    setExporting(format)
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      const params = new URLSearchParams({ format })
      if (typeFilter !== ALL_TYPES) params.set("type", typeFilter)
      await downloadExportFile(`/api/audit/export?${params.toString()}`, `audit-log-${stamp}.${format === "pdf" ? "pdf" : "csv"}`)
      toast({ title: format === "pdf" ? "PDF downloaded" : "Excel file downloaded" })
    } catch (error) {
      toast({ title: "Export failed", description: getErrorMessage(error), variant: "destructive" })
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track who recorded each payment, payout, and finance entry in the system.
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

      <Card className="p-4 sm:p-5 border-muted/50 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by person, description, or recorded by..."
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full lg:w-[220px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem value={ALL_TYPES}>All types</SelectItem>
              {(Object.keys(TYPE_LABELS) as AuditEntryType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden border-muted/50 shadow-sm">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6 min-w-[160px]">Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="min-w-[180px]">Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="hidden md:table-cell">Note</TableHead>
                  <TableHead className="pr-6 min-w-[180px]">Recorded By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                      No audit entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry) => (
                    <TableRow key={`${entry.type}-${entry.id}`} className="hover:bg-muted/40">
                      <TableCell className="pl-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.occurredAt)}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge className={typeBadgeClass(entry.type)}>{TYPE_LABELS[entry.type]}</Badge>
                      </TableCell>
                      <TableCell className="py-4 font-medium">{entry.description}</TableCell>
                      <TableCell className="py-4 text-right font-semibold tabular-nums whitespace-nowrap">
                        {formatMoney(entry.amount, entry.currency)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-4 text-sm text-muted-foreground max-w-[220px] truncate">
                        {entry.note ?? "—"}
                      </TableCell>
                      <TableCell className="pr-6 py-4">
                        {entry.recordedBy ? (
                          <div className="flex items-start gap-2 min-w-[160px]">
                            <UserCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-sm font-medium leading-tight">{entry.recordedBy.name}</p>
                              <p className="text-xs text-muted-foreground">{entry.recordedBy.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4 border-t">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={pagination.page <= 1 || loading} onClick={() => void fetchAuditLog(pagination.page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => void fetchAuditLog(pagination.page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
