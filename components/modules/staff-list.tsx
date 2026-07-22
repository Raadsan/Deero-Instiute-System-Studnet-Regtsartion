"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Pencil, Trash2, Search, Users, DollarSign, Receipt, Briefcase, Phone, Mail, User } from "lucide-react"

import { api } from "@/lib/api"
import { formatMoney, currentPeriodLabel } from "@/lib/finance-utils"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type StaffSummary = {
  id: string
  name: string
  email: string | null
  phone: string | null
  jobTitle: string | null
  monthlySalary: number
  totalPaidOut: number
  balanceDue: number
  isActive: boolean
}

type StaffResponse = {
  staff: StaffSummary[]
  totals: {
    staffCount: number
    activeStaff: number
    monthlyPayroll: number
    totalPaidOut: number
    balanceDue: number
  }
}

type StaffPayout = {
  id: string
  amount: number
  currency: string
  paidAt: string
  note: string | null
  period: string | null
  recordedBy: { id: string; name: string; email: string; role: string } | null
}

function getErrorMessage(error: unknown) {
  const err = error as { response?: { data?: { message?: string } }; message?: string }
  return err?.response?.data?.message ?? err?.message ?? "Something went wrong."
}

export default function StaffList() {
  const [staff, setStaff] = useState<StaffSummary[]>([])
  const [totals, setTotals] = useState<StaffResponse["totals"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [editing, setEditing] = useState<StaffSummary | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<StaffSummary | null>(null)
  const [payouts, setPayouts] = useState<StaffPayout[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingPayouts, setLoadingPayouts] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [monthlySalary, setMonthlySalary] = useState("0")
  const [isActive, setIsActive] = useState(true)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [payoutAmount, setPayoutAmount] = useState("")
  const [payoutNote, setPayoutNote] = useState("")
  const [payoutPeriod, setPayoutPeriod] = useState(currentPeriodLabel())
  const [recordingPayout, setRecordingPayout] = useState(false)

  const resetForm = () => {
    setEditing(null)
    setName("")
    setEmail("")
    setPhone("")
    setJobTitle("")
    setMonthlySalary("0")
    setIsActive(true)
  }

  const fetchStaff = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<StaffResponse>("/api/staff?includeInactive=true")
      setStaff(res.data.staff)
      setTotals(res.data.totals)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const fetchPayouts = async (staffId: string) => {
    setLoadingPayouts(true)
    try {
      const res = await api.get<StaffPayout[]>(`/api/staff/${staffId}/payouts`)
      setPayouts(res.data)
    } catch (e: unknown) {
      toast({ title: "Failed to load payouts", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setLoadingPayouts(false)
    }
  }

  useEffect(() => {
    void fetchStaff()
  }, [])

  const filteredStaff = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return staff
    return staff.filter((member) => {
      return (
        member.name.toLowerCase().includes(term) ||
        (member.email ?? "").toLowerCase().includes(term) ||
        (member.phone ?? "").toLowerCase().includes(term) ||
        (member.jobTitle ?? "").toLowerCase().includes(term)
      )
    })
  }, [staff, searchTerm])

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (member: StaffSummary) => {
    setEditing(member)
    setName(member.name)
    setEmail(member.email ?? "")
    setPhone(member.phone ?? "")
    setJobTitle(member.jobTitle ?? "")
    setMonthlySalary(String(member.monthlySalary))
    setIsActive(member.isActive)
    setFormOpen(true)
  }

  const openPayout = async (member: StaffSummary) => {
    setSelectedStaff(member)
    setPayoutAmount(String(member.balanceDue || member.monthlySalary))
    setPayoutPeriod(currentPeriodLabel())
    setPayoutNote("")
    setPayoutOpen(true)
    await fetchPayouts(member.id)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Staff name is required", variant: "destructive" })
      return
    }

    const salary = Number(monthlySalary)
    if (Number.isNaN(salary) || salary < 0) {
      toast({ title: "Enter a valid monthly salary", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        jobTitle: jobTitle.trim() || null,
        monthlySalary: salary,
        isActive,
      }

      if (editing) {
        await api.patch(`/api/staff/${editing.id}`, payload)
        toast({ title: "Staff member updated" })
      } else {
        await api.post("/api/staff", payload)
        toast({ title: "Staff member created" })
      }

      setFormOpen(false)
      resetForm()
      await fetchStaff()
    } catch (e: unknown) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/staff/${deleteId}`)
      toast({ title: "Staff member deleted" })
      setDeleteId(null)
      if (selectedStaff?.id === deleteId) setPayoutOpen(false)
      await fetchStaff()
    } catch (e: unknown) {
      toast({ title: "Delete failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const handleRecordPayout = async () => {
    if (!selectedStaff) return
    const amount = Number(payoutAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid payout amount", variant: "destructive" })
      return
    }

    setRecordingPayout(true)
    try {
      await api.post(`/api/staff/${selectedStaff.id}/payouts`, {
        amount,
        note: payoutNote.trim() || null,
        period: payoutPeriod.trim() || null,
      })
      toast({ title: "Salary payout recorded" })
      await fetchStaff()
      await fetchPayouts(selectedStaff.id)
      const refreshed = (await api.get<StaffResponse>("/api/staff?includeInactive=true")).data.staff.find(
        (row) => row.id === selectedStaff.id,
      )
      if (refreshed) setSelectedStaff(refreshed)
      setPayoutNote("")
    } catch (e: unknown) {
      toast({ title: "Payout failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setRecordingPayout(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Payroll</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage non-teaching staff, monthly salaries, and salary payouts.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 self-start">
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Staff</p>
                <p className="text-2xl font-bold">{totals.activeStaff}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Payroll</p>
                <p className="text-2xl font-bold">{formatMoney(totals.monthlyPayroll)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Receipt className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Paid Out</p>
                <p className="text-2xl font-bold">{formatMoney(totals.totalPaidOut)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                <p className="text-2xl font-bold">{formatMoney(totals.balanceDue)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search staff..."
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{filteredStaff.length} staff</Badge>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-destructive">{error}</div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No staff members yet. Add your first staff member.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead className="text-right">Monthly Salary</TableHead>
                  <TableHead className="text-right">Paid Out</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((member) => (
                  <TableRow
                    key={member.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => void openPayout(member)}
                  >
                    <TableCell>
                      <div className="font-medium">{member.name}</div>
                      {member.email && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3" />
                          {member.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{member.jobTitle ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(member.monthlySalary)}</TableCell>
                    <TableCell className="text-right">{formatMoney(member.totalPaidOut)}</TableCell>
                    <TableCell className="text-right">{formatMoney(member.balanceDue)}</TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(member)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(member.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
            <DialogDescription>Enter staff details and set the monthly salary.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="staff-name">Name *</Label>
              <Input id="staff-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. John Smith" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input id="staff-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input id="staff-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="staff-job-title">Job Title</Label>
                <Input id="staff-job-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. Accountant" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-salary">Monthly Salary *</Label>
                <Input
                  id="staff-salary"
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlySalary}
                  onChange={(event) => setMonthlySalary(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active Staff</p>
                <p className="text-xs text-muted-foreground">Inactive staff stay in history but are excluded from active payroll totals.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : editing ? "Save Changes" : "Create Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStaff?.name ?? "Staff Details"}</DialogTitle>
            <DialogDescription>Salary summary and payout history.</DialogDescription>
          </DialogHeader>

          {selectedStaff && (
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="payouts">Payouts</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <div className="mt-2 space-y-1 text-sm">
                      {selectedStaff.jobTitle && (
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          {selectedStaff.jobTitle}
                        </div>
                      )}
                      {selectedStaff.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {selectedStaff.phone}
                        </div>
                      )}
                      {selectedStaff.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {selectedStaff.email}
                        </div>
                      )}
                      {!selectedStaff.jobTitle && !selectedStaff.phone && !selectedStaff.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          No contact details
                        </div>
                      )}
                    </div>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Salary Summary</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Monthly Salary</p>
                        <p className="font-semibold">{formatMoney(selectedStaff.monthlySalary)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Paid Out</p>
                        <p className="font-semibold">{formatMoney(selectedStaff.totalPaidOut)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Balance</p>
                        <p className="font-semibold">{formatMoney(selectedStaff.balanceDue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-semibold">{selectedStaff.isActive ? "Active" : "Inactive"}</p>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="payouts" className="space-y-4 mt-4">
                <Card className="p-4 space-y-3">
                  <p className="font-medium">Record Salary Payout</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payoutAmount}
                        onChange={(event) => setPayoutAmount(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Period</Label>
                      <Input
                        value={payoutPeriod}
                        onChange={(event) => setPayoutPeriod(event.target.value)}
                        placeholder="2026-07"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Note</Label>
                      <Input
                        value={payoutNote}
                        onChange={(event) => setPayoutNote(event.target.value)}
                        placeholder="Optional note"
                      />
                    </div>
                  </div>
                  <Button onClick={() => void handleRecordPayout()} disabled={recordingPayout}>
                    {recordingPayout ? <Spinner className="h-4 w-4" /> : "Record Payout"}
                  </Button>
                </Card>

                {loadingPayouts ? (
                  <div className="flex justify-center py-8">
                    <Spinner className="h-6 w-6" />
                  </div>
                ) : payouts.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Recorded By</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell>{new Date(payout.paidAt).toLocaleDateString()}</TableCell>
                          <TableCell>{payout.period ?? "—"}</TableCell>
                          <TableCell>{payout.note ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{payout.recordedBy?.name ?? "Unknown"}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(payout.amount, payout.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No payouts recorded yet.</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the staff member and all salary payout history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
