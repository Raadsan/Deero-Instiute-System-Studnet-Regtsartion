"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Search, TrendingUp, TrendingDown, Receipt, ArrowDownCircle, ArrowUpCircle } from "lucide-react"

import { api } from "@/lib/api"
import { formatMoney } from "@/lib/finance-utils"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type EntryType = "INCOME" | "EXPENSE"

type FinanceEntry = {
  id: string
  type: EntryType
  title: string
  amount: number
  category: string | null
  note: string | null
  occurredAt: string
  recordedBy: { id: string; name: string; email: string; role: string } | null
}

const ALL_TYPES = "__all__"
const selectContentClass = "z-[200] bg-background border shadow-xl"

function getErrorMessage(error: unknown) {
  const err = error as { response?: { data?: { message?: string } }; message?: string }
  return err?.response?.data?.message ?? err?.message ?? "Something went wrong."
}

export default function FinanceExpenses() {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES)

  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [entryType, setEntryType] = useState<EntryType>("EXPENSE")
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("")
  const [note, setNote] = useState("")

  const resetForm = () => {
    setEntryType("EXPENSE")
    setTitle("")
    setAmount("")
    setCategory("")
    setNote("")
  }

  const fetchEntries = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<FinanceEntry[]>("/api/finance/entries")
      setEntries(res.data)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchEntries()
  }, [])

  const totals = useMemo(() => {
    const income = entries.filter((row) => row.type === "INCOME").reduce((sum, row) => sum + row.amount, 0)
    const expenses = entries.filter((row) => row.type === "EXPENSE").reduce((sum, row) => sum + row.amount, 0)
    return { income, expenses, net: income - expenses }
  }, [entries])

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return entries.filter((entry) => {
      if (typeFilter !== ALL_TYPES && entry.type !== typeFilter) return false
      if (!term) return true
      return (
        entry.title.toLowerCase().includes(term) ||
        (entry.category ?? "").toLowerCase().includes(term) ||
        (entry.note ?? "").toLowerCase().includes(term)
      )
    })
  }, [entries, searchTerm, typeFilter])

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" })
      return
    }

    const parsedAmount = Number(amount)
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      await api.post("/api/finance/entries", {
        type: entryType,
        title: title.trim(),
        amount: parsedAmount,
        category: category.trim() || null,
        note: note.trim() || null,
      })
      toast({ title: entryType === "INCOME" ? "Income recorded" : "Expense recorded" })
      setFormOpen(false)
      resetForm()
      await fetchEntries()
    } catch (e: unknown) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Income & Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track manual income and operating expenses outside student fees and payroll.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2 self-start">
          <Plus className="h-4 w-4" />
          Add Entry
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold">{formatMoney(totals.income)}</p>
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
              <p className="text-2xl font-bold">{formatMoney(totals.expenses)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net (Manual)</p>
              <p className="text-2xl font-bold">{formatMoney(totals.net)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search entries..."
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value={ALL_TYPES}>All types</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="secondary">{filteredEntries.length} entries</Badge>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-destructive">{error}</div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No entries yet. Record your first income or expense.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.occurredAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          entry.type === "INCOME"
                            ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                            : "border-red-200 text-red-700 bg-red-50"
                        }
                      >
                        <span className="flex items-center gap-1">
                          {entry.type === "INCOME" ? (
                            <ArrowUpCircle className="h-3 w-3" />
                          ) : (
                            <ArrowDownCircle className="h-3 w-3" />
                          )}
                          {entry.type === "INCOME" ? "Income" : "Expense"}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{entry.title}</TableCell>
                    <TableCell>{entry.category ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{entry.note ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.recordedBy?.name ?? "Unknown"}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        entry.type === "INCOME" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {entry.type === "INCOME" ? "+" : "−"}
                      {formatMoney(entry.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Entry</DialogTitle>
            <DialogDescription>Record a manual income or expense entry.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={entryType} onValueChange={(value) => setEntryType(value as EntryType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="entry-title">Title *</Label>
              <Input
                id="entry-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Office supplies"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="entry-amount">Amount *</Label>
                <Input
                  id="entry-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="entry-category">Category</Label>
                <Input
                  id="entry-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="e.g. Utilities"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="entry-note">Note</Label>
              <Input
                id="entry-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : "Save Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
