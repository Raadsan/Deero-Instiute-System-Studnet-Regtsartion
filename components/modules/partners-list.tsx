"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Handshake,
  GraduationCap,
  Users,
  DollarSign,
  School,
  Receipt,
  Phone,
  Mail,
  User,
} from "lucide-react"

import { api } from "@/lib/api"
import type { AppRole } from "@/lib/auth"
import { formatMoney, type PartnerClassLink, type PartnerSummary } from "@/lib/partner-utils"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
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

type ClassOption = {
  id: string
  name: string
  level: string | null
  studentsCount: number
  isActive: boolean
}

type PartnersResponse = {
  partners: PartnerSummary[]
  totals: {
    partnersCount: number
    activePartners: number
    classesCount: number
    studentsCount: number
    monthlyDue: number
    totalPaidOut: number
    balanceDue: number
  }
}

type PartnerDetail = PartnerSummary & {
  payouts: Array<{
    id: string
    amount: number
    currency: string
    paidAt: string
    note: string | null
    period: string | null
    recordedBy: { id: string; name: string; email: string; role: string } | null
  }>
}

function getErrorMessage(error: unknown) {
  const err = error as { response?: { data?: { message?: string } }; message?: string }
  return err?.response?.data?.message ?? err?.message ?? "Something went wrong."
}

function currentPeriodLabel() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export default function PartnersList() {
  const [partners, setPartners] = useState<PartnerSummary[]>([])
  const [totals, setTotals] = useState<PartnersResponse["totals"] | null>(null)
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [assignedClassMap, setAssignedClassMap] = useState<Map<string, string>>(new Map())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editing, setEditing] = useState<PartnerSummary | null>(null)
  const [detailPartner, setDetailPartner] = useState<PartnerDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [name, setName] = useState("")
  const [contactName, setContactName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [feePerStudent, setFeePerStudent] = useState("0")
  const [isActive, setIsActive] = useState(true)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [payoutAmount, setPayoutAmount] = useState("")
  const [payoutNote, setPayoutNote] = useState("")
  const [payoutPeriod, setPayoutPeriod] = useState(currentPeriodLabel())
  const [recordingPayout, setRecordingPayout] = useState(false)
  const [canManage, setCanManage] = useState(false)

  const resetForm = () => {
    setEditing(null)
    setName("")
    setContactName("")
    setPhone("")
    setEmail("")
    setFeePerStudent("0")
    setIsActive(true)
    setSelectedClassIds([])
  }

  const buildAssignedClassMap = (rows: PartnerSummary[], currentPartnerId?: string) => {
    const map = new Map<string, string>()
    for (const partner of rows) {
      if (currentPartnerId && partner.id === currentPartnerId) continue
      for (const link of partner.classes) {
        map.set(link.classId, partner.name)
      }
    }
    return map
  }

  const fetchClasses = async () => {
    try {
      const res = await api.get<ClassOption[]>("/api/classes")
      setClasses(res.data.filter((row) => row.isActive))
    } catch (e: unknown) {
      toast({ title: "Failed to load classes", description: getErrorMessage(e), variant: "destructive" })
    }
  }

  const fetchPartners = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<PartnersResponse>("/api/partners?includeInactive=true")
      setPartners(res.data.partners)
      setTotals(res.data.totals)
      setAssignedClassMap(buildAssignedClassMap(res.data.partners))
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const fetchPartnerDetail = async (partnerId: string) => {
    setLoadingDetail(true)
    try {
      const res = await api.get<PartnerDetail>(`/api/partners/${partnerId}`)
      setDetailPartner(res.data)
    } catch (e: unknown) {
      toast({ title: "Failed to load partner details", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ role: AppRole }>("/api/auth/me")
        setCanManage(res.data.role === "ADMIN")
      } catch {
        setCanManage(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (canManage) void fetchClasses()
  }, [canManage])

  useEffect(() => {
    void fetchPartners()
  }, [])

  const filteredPartners = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return partners
    return partners.filter((partner) => {
      return (
        partner.name.toLowerCase().includes(term) ||
        (partner.contactName ?? "").toLowerCase().includes(term) ||
        (partner.email ?? "").toLowerCase().includes(term) ||
        partner.classes.some((link) => link.className.toLowerCase().includes(term))
      )
    })
  }, [partners, searchTerm])

  const previewTotals = useMemo(() => {
    const fee = Number(feePerStudent) || 0
    const selected = classes.filter((row) => selectedClassIds.includes(row.id))
    const studentsCount = selected.reduce((sum, row) => sum + row.studentsCount, 0)
    return {
      classesCount: selected.length,
      studentsCount,
      monthlyDue: studentsCount * fee,
    }
  }, [classes, selectedClassIds, feePerStudent])

  const openCreate = () => {
    resetForm()
    setAssignedClassMap(buildAssignedClassMap(partners))
    setFormOpen(true)
  }

  const openEdit = (partner: PartnerSummary) => {
    setEditing(partner)
    setName(partner.name)
    setContactName(partner.contactName ?? "")
    setPhone(partner.phone ?? "")
    setEmail(partner.email ?? "")
    setFeePerStudent(String(partner.feePerStudent))
    setIsActive(partner.isActive)
    setSelectedClassIds(partner.classes.map((link) => link.classId))
    setAssignedClassMap(buildAssignedClassMap(partners, partner.id))
    setFormOpen(true)
  }

  const openDetail = async (partner: PartnerSummary) => {
    setDetailOpen(true)
    setPayoutAmount(String(partner.monthlyDue))
    setPayoutPeriod(currentPeriodLabel())
    setPayoutNote("")
    await fetchPartnerDetail(partner.id)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Partner name is required", variant: "destructive" })
      return
    }

    const fee = Number(feePerStudent)
    if (Number.isNaN(fee) || fee < 0) {
      toast({ title: "Enter a valid fee per student", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        feePerStudent: fee,
        isActive,
        classIds: selectedClassIds,
      }

      if (editing) {
        await api.patch(`/api/partners/${editing.id}`, payload)
        toast({ title: "Partner updated" })
      } else {
        await api.post("/api/partners", payload)
        toast({ title: "Partner created" })
      }

      setFormOpen(false)
      resetForm()
      await fetchPartners()
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
      await api.delete(`/api/partners/${deleteId}`)
      toast({ title: "Partner deleted" })
      setDeleteId(null)
      if (detailPartner?.id === deleteId) setDetailOpen(false)
      await fetchPartners()
    } catch (e: unknown) {
      toast({ title: "Delete failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const handleRecordPayout = async () => {
    if (!detailPartner) return
    const amount = Number(payoutAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid payout amount", variant: "destructive" })
      return
    }

    setRecordingPayout(true)
    try {
      await api.post(`/api/partners/${detailPartner.id}/payouts`, {
        amount,
        note: payoutNote.trim() || null,
        period: payoutPeriod.trim() || null,
      })
      toast({ title: "Payout recorded" })
      await fetchPartners()
      await fetchPartnerDetail(detailPartner.id)
      setPayoutNote("")
    } catch (e: unknown) {
      toast({ title: "Payout failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setRecordingPayout(false)
    }
  }

  const toggleClass = (classId: string) => {
    setSelectedClassIds((current) =>
      current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId],
    )
  }

  const renderClassBreakdown = (rows: PartnerClassLink[]) => {
    if (!rows.length) {
      return <p className="text-sm text-muted-foreground py-4">No classes assigned yet.</p>
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Class</TableHead>
            <TableHead className="text-right">Students</TableHead>
            <TableHead className="text-right">Fee / Student</TableHead>
            <TableHead className="text-right">Monthly Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="font-medium">{row.className}</div>
                {row.classLevel && <div className="text-xs text-muted-foreground">{row.classLevel}</div>}
              </TableCell>
              <TableCell className="text-right">{row.studentsCount}</TableCell>
              <TableCell className="text-right">{formatMoney(row.feePerStudent)}</TableCell>
              <TableCell className="text-right font-medium">{formatMoney(row.monthlyDue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Partners</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canManage
              ? "Manage partner agencies, assign classes, and track monthly partner payouts."
              : "View partner agencies, balances, and record monthly payouts."}
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2 self-start">
            <Plus className="h-4 w-4" />
            Add Partner
          </Button>
        )}
      </div>

      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Handshake className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Partners</p>
                <p className="text-2xl font-bold">{totals.activePartners}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Students via Partners</p>
                <p className="text-2xl font-bold">{totals.studentsCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Partner Due</p>
                <p className="text-2xl font-bold">{formatMoney(totals.monthlyDue)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Receipt className="h-5 w-5 text-emerald-600" />
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
              placeholder="Search partners or classes..."
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{filteredPartners.length} partners</Badge>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-destructive">{error}</div>
        ) : filteredPartners.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Handshake className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{canManage ? "No partners yet. Add your first agency partner." : "No partners yet."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Classes</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Monthly Due</TableHead>
                  <TableHead className="text-right">Paid Out</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.map((partner) => (
                  <TableRow key={partner.id} className="cursor-pointer hover:bg-muted/40" onClick={() => void openDetail(partner)}>
                    <TableCell>
                      <div className="font-medium">{partner.name}</div>
                      {partner.contactName && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <User className="h-3 w-3" />
                          {partner.contactName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {partner.classes.slice(0, 2).map((link) => (
                          <Badge key={link.id} variant="outline" className="text-xs">
                            {link.className}
                          </Badge>
                        ))}
                        {partner.classes.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{partner.classes.length - 2}
                          </Badge>
                        )}
                        {!partner.classes.length && <span className="text-xs text-muted-foreground">No classes</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{partner.studentsCount}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(partner.monthlyDue)}</TableCell>
                    <TableCell className="text-right">{formatMoney(partner.totalPaidOut)}</TableCell>
                    <TableCell className="text-right">{formatMoney(partner.balanceDue)}</TableCell>
                    <TableCell>
                      <Badge variant={partner.isActive ? "default" : "secondary"}>
                        {partner.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(partner)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(partner.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Partner" : "Add Partner"}</DialogTitle>
            <DialogDescription>
              Enter the agency name, set the monthly fee per student, then assign classes. Totals update automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="partner-name">Partner Name *</Label>
              <Input id="partner-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. NISA Agency" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact-name">Contact Person</Label>
                <Input id="contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="partner-phone">Phone</Label>
                <Input id="partner-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="partner-email">Email</Label>
                <Input id="partner-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fee-per-student">Fee per Student (Monthly) *</Label>
                <Input
                  id="fee-per-student"
                  type="number"
                  min="0"
                  step="0.01"
                  value={feePerStudent}
                  onChange={(event) => setFeePerStudent(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active Partner</p>
                <p className="text-xs text-muted-foreground">Inactive partners stay in history but are hidden from active totals.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <School className="h-4 w-4 text-primary" />
                <p className="font-medium">Assign Classes</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-md bg-background border p-3">
                  <p className="text-xs text-muted-foreground">Classes</p>
                  <p className="text-xl font-bold">{previewTotals.classesCount}</p>
                </div>
                <div className="rounded-md bg-background border p-3">
                  <p className="text-xs text-muted-foreground">Students</p>
                  <p className="text-xl font-bold">{previewTotals.studentsCount}</p>
                </div>
                <div className="rounded-md bg-background border p-3">
                  <p className="text-xs text-muted-foreground">Monthly Due</p>
                  <p className="text-xl font-bold">{formatMoney(previewTotals.monthlyDue)}</p>
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {classes.map((row) => {
                  const assignedTo = assignedClassMap.get(row.id)
                  const disabled = Boolean(assignedTo)
                  const checked = selectedClassIds.includes(row.id)
                  return (
                    <label
                      key={row.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-background"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => !disabled && toggleClass(row.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{row.name}</span>
                          {row.level && <Badge variant="outline">{row.level}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {row.studentsCount} students
                          {disabled ? ` · assigned to ${assignedTo}` : ""}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : editing ? "Save Changes" : "Create Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailPartner?.name ?? "Partner Details"}</DialogTitle>
            <DialogDescription>Class breakdown, monthly totals, and payout history.</DialogDescription>
          </DialogHeader>

          {loadingDetail || !detailPartner ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
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
                      {detailPartner.contactName && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {detailPartner.contactName}
                        </div>
                      )}
                      {detailPartner.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {detailPartner.phone}
                        </div>
                      )}
                      {detailPartner.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {detailPartner.email}
                        </div>
                      )}
                    </div>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Monthly Summary</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Classes</p>
                        <p className="font-semibold">{detailPartner.classesCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Students</p>
                        <p className="font-semibold">{detailPartner.studentsCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monthly Due</p>
                        <p className="font-semibold">{formatMoney(detailPartner.monthlyDue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Balance</p>
                        <p className="font-semibold">{formatMoney(detailPartner.balanceDue)}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {renderClassBreakdown(detailPartner.classes)}
              </TabsContent>

              <TabsContent value="payouts" className="space-y-4 mt-4">
                <Card className="p-4 space-y-3">
                  <p className="font-medium">Record Payout</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label>Amount</Label>
                      <Input type="number" min="0" step="0.01" value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Period</Label>
                      <Input value={payoutPeriod} onChange={(event) => setPayoutPeriod(event.target.value)} placeholder="2026-07" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Note</Label>
                      <Input value={payoutNote} onChange={(event) => setPayoutNote(event.target.value)} placeholder="Optional note" />
                    </div>
                  </div>
                  <Button onClick={() => void handleRecordPayout()} disabled={recordingPayout}>
                    {recordingPayout ? <Spinner className="h-4 w-4" /> : "Record Payout"}
                  </Button>
                </Card>

                {detailPartner.payouts.length ? (
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
                      {detailPartner.payouts.map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell>{new Date(payout.paidAt).toLocaleDateString()}</TableCell>
                          <TableCell>{payout.period ?? "—"}</TableCell>
                          <TableCell>{payout.note ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{payout.recordedBy?.name ?? "Unknown"}</TableCell>
                          <TableCell className="text-right font-medium">{formatMoney(payout.amount, payout.currency)}</TableCell>
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
            <AlertDialogTitle>Delete partner?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the partner, class links, and payout history. This action cannot be undone.
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
