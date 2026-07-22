"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  FileText,
  Users,
  DollarSign,
  Percent,
  Receipt,
  Mail,
} from "lucide-react"

import { api } from "@/lib/api"
import type { AppRole } from "@/lib/auth"
import {
  calculateMonthlyPay,
  formatMoney,
  type CompensationType,
  type ContractSummary,
  type TeacherPayrollSummary,
} from "@/lib/contract-utils"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

type TeacherOption = {
  id: string
  name: string
  email: string
  isActive: boolean
  classes: Array<{ id: string; name: string; level: string | null }>
}

type ClassRevenue = {
  classId: string
  className: string
  classLevel: string | null
  studentsCount: number
  classMonthlyCollected: number
  classTotalCollected: number
}

type ContractsResponse = {
  contracts: ContractSummary[]
  teachers: TeacherPayrollSummary[]
  totals: {
    contractsCount: number
    activeContracts: number
    teachersCount: number
    classesCount: number
    studentsCount: number
    monthlyPay: number
    totalPaidOut: number
    balanceDue: number
  }
}

type ContractDetail = ContractSummary & {
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

const selectContentClass = "z-[200] bg-background border shadow-xl"

function getErrorMessage(error: unknown) {
  const err = error as { response?: { data?: { message?: string } }; message?: string }
  return err?.response?.data?.message ?? err?.message ?? "Something went wrong."
}

function currentPeriodLabel() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function compensationLabel(type: CompensationType, salaryAmount: number | null, percentage: number | null) {
  if (type === "SALARY") return `${formatMoney(salaryAmount ?? 0)} / month`
  return `${percentage ?? 0}% of class revenue`
}

export default function ContractsList() {
  const [contracts, setContracts] = useState<ContractSummary[]>([])
  const [teachersSummary, setTeachersSummary] = useState<TeacherPayrollSummary[]>([])
  const [totals, setTotals] = useState<ContractsResponse["totals"] | null>(null)
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [classRevenue, setClassRevenue] = useState<ClassRevenue[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editing, setEditing] = useState<ContractSummary | null>(null)
  const [detailContract, setDetailContract] = useState<ContractDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [teacherId, setTeacherId] = useState("")
  const [classId, setClassId] = useState("")
  const [compensationType, setCompensationType] = useState<CompensationType>("SALARY")
  const [salaryAmount, setSalaryAmount] = useState("0")
  const [percentage, setPercentage] = useState("0")
  const [isActive, setIsActive] = useState(true)
  const [note, setNote] = useState("")

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [payoutAmount, setPayoutAmount] = useState("")
  const [payoutNote, setPayoutNote] = useState("")
  const [payoutPeriod, setPayoutPeriod] = useState(currentPeriodLabel())
  const [recordingPayout, setRecordingPayout] = useState(false)
  const [canManage, setCanManage] = useState(false)

  const resetForm = () => {
    setEditing(null)
    setTeacherId("")
    setClassId("")
    setCompensationType("SALARY")
    setSalaryAmount("0")
    setPercentage("0")
    setIsActive(true)
    setNote("")
  }

  const fetchTeachers = async () => {
    try {
      const res = await api.get<TeacherOption[]>("/api/teachers?includeInactive=true")
      setTeachers(res.data.filter((row) => row.isActive))
    } catch (e: unknown) {
      toast({ title: "Failed to load teachers", description: getErrorMessage(e), variant: "destructive" })
    }
  }

  const fetchClassRevenue = async () => {
    try {
      const res = await api.get<{ byClass: Array<{ classId: string | null; className: string; totalCollected: number; totalStudents: number }> }>(
        "/api/payments/summary",
      )
      const rows = res.data.byClass
        .filter((row) => row.classId)
        .map((row) => ({
          classId: row.classId!,
          className: row.className,
          classLevel: null,
          studentsCount: row.totalStudents,
          classMonthlyCollected: 0,
          classTotalCollected: row.totalCollected,
        }))

      const monthlyMap = new Map(
        contracts.map((row) => [row.classId, row.classMonthlyCollected]),
      )

      setClassRevenue(
        rows.map((row) => ({
          ...row,
          classMonthlyCollected: monthlyMap.get(row.classId) ?? row.classMonthlyCollected,
        })),
      )
    } catch {
      setClassRevenue([])
    }
  }

  const fetchContracts = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<ContractsResponse>("/api/contracts?includeInactive=true")
      setContracts(res.data.contracts)
      setTeachersSummary(res.data.teachers)
      setTotals(res.data.totals)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const fetchContractDetail = async (contractId: string) => {
    setLoadingDetail(true)
    try {
      const res = await api.get<ContractDetail>(`/api/contracts/${contractId}`)
      setDetailContract(res.data)
    } catch (e: unknown) {
      toast({ title: "Failed to load contract details", description: getErrorMessage(e), variant: "destructive" })
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
    if (canManage) void fetchTeachers()
  }, [canManage])

  useEffect(() => {
    void fetchContracts()
  }, [])

  useEffect(() => {
    if (contracts.length) {
      setClassRevenue(Array.from(
        contracts.reduce<Map<string, ClassRevenue>>((map, row) => {
          map.set(row.classId, {
            classId: row.classId,
            className: row.className,
            classLevel: row.classLevel,
            studentsCount: row.studentsCount,
            classMonthlyCollected: row.classMonthlyCollected,
            classTotalCollected: row.classTotalCollected,
          })
          return map
        }, new Map()).values(),
      ))
    } else {
      void fetchClassRevenue()
    }
  }, [contracts])

  const selectedTeacher = useMemo(
    () => teachers.find((row) => row.id === teacherId) ?? null,
    [teachers, teacherId],
  )

  const teacherClasses = useMemo(() => selectedTeacher?.classes ?? [], [selectedTeacher])

  const selectedClassStats = useMemo(() => {
    return classRevenue.find((row) => row.classId === classId) ?? contracts.find((row) => row.classId === classId) ?? null
  }, [classRevenue, classId, contracts])

  const previewMonthlyPay = useMemo(() => {
    const monthlyCollected =
      selectedClassStats && "classMonthlyCollected" in selectedClassStats
        ? selectedClassStats.classMonthlyCollected
        : 0

    return calculateMonthlyPay({
      compensationType,
      salaryAmount: Number(salaryAmount) || 0,
      percentage: Number(percentage) || 0,
      classMonthlyCollected: monthlyCollected,
    })
  }, [compensationType, salaryAmount, percentage, selectedClassStats])

  const filteredContracts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return contracts
    return contracts.filter((row) => {
      return (
        row.teacherName.toLowerCase().includes(term) ||
        row.className.toLowerCase().includes(term) ||
        row.teacherEmail.toLowerCase().includes(term)
      )
    })
  }, [contracts, searchTerm])

  const filteredTeachers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return teachersSummary
    return teachersSummary.filter((row) => {
      return (
        row.teacherName.toLowerCase().includes(term) ||
        row.teacherEmail.toLowerCase().includes(term) ||
        row.contracts.some((contract) => contract.className.toLowerCase().includes(term))
      )
    })
  }, [teachersSummary, searchTerm])

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (contract: ContractSummary) => {
    setEditing(contract)
    setTeacherId(contract.teacherId)
    setClassId(contract.classId)
    setCompensationType(contract.compensationType)
    setSalaryAmount(String(contract.salaryAmount ?? 0))
    setPercentage(String(contract.percentage ?? 0))
    setIsActive(contract.isActive)
    setNote(contract.note ?? "")
    setFormOpen(true)
  }

  const openDetail = async (contract: ContractSummary) => {
    setDetailOpen(true)
    setPayoutAmount(String(contract.monthlyPay))
    setPayoutPeriod(currentPeriodLabel())
    setPayoutNote("")
    await fetchContractDetail(contract.id)
  }

  const handleSave = async () => {
    if (!teacherId || !classId) {
      toast({ title: "Select a teacher and class", variant: "destructive" })
      return
    }

    const payload = {
      teacherId,
      classId,
      compensationType,
      salaryAmount: compensationType === "SALARY" ? Number(salaryAmount) || 0 : null,
      percentage: compensationType === "PERCENTAGE" ? Number(percentage) || 0 : null,
      isActive,
      note: note.trim() || null,
    }

    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/api/contracts/${editing.id}`, payload)
        toast({ title: "Contract updated" })
      } else {
        await api.post("/api/contracts", payload)
        toast({ title: "Contract created" })
      }

      setFormOpen(false)
      resetForm()
      await fetchContracts()
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
      await api.delete(`/api/contracts/${deleteId}`)
      toast({ title: "Contract deleted" })
      setDeleteId(null)
      if (detailContract?.id === deleteId) setDetailOpen(false)
      await fetchContracts()
    } catch (e: unknown) {
      toast({ title: "Delete failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const handleRecordPayout = async () => {
    if (!detailContract) return
    const amount = Number(payoutAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid payout amount", variant: "destructive" })
      return
    }

    setRecordingPayout(true)
    try {
      await api.post(`/api/contracts/${detailContract.id}/payouts`, {
        amount,
        note: payoutNote.trim() || null,
        period: payoutPeriod.trim() || null,
      })
      toast({ title: "Payout recorded" })
      await fetchContracts()
      await fetchContractDetail(detailContract.id)
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
          <h1 className="text-2xl font-bold tracking-tight">Teacher Contracts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canManage
              ? "Set teacher pay by fixed salary or class revenue percentage, then track monthly payouts."
              : "View teacher payroll, balances, and record monthly payouts."}
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2 self-start">
            <Plus className="h-4 w-4" />
            Add Contract
          </Button>
        )}
      </div>

      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Contracts</p>
                <p className="text-2xl font-bold">{totals.activeContracts}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Teachers on Payroll</p>
                <p className="text-2xl font-bold">{totals.teachersCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Teacher Pay</p>
                <p className="text-2xl font-bold">{formatMoney(totals.monthlyPay)}</p>
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
              placeholder="Search teachers or classes..."
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{filteredContracts.length} contracts</Badge>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-destructive">{error}</div>
        ) : (
          <Tabs defaultValue="contracts">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="contracts">All Contracts</TabsTrigger>
              <TabsTrigger value="teachers">By Teacher</TabsTrigger>
            </TabsList>

            <TabsContent value="contracts" className="mt-4">
              {filteredContracts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>{canManage ? "No contracts yet. Add the first teacher contract." : "No contracts yet."}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Pay Type</TableHead>
                        <TableHead className="text-right">Monthly Pay</TableHead>
                        <TableHead className="text-right">Paid Out</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        {canManage && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContracts.map((contract) => (
                        <TableRow
                          key={contract.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => void openDetail(contract)}
                        >
                          <TableCell>
                            <div className="font-medium">{contract.teacherName}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Mail className="h-3 w-3" />
                              {contract.teacherEmail}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{contract.className}</div>
                            {contract.classLevel && (
                              <div className="text-xs text-muted-foreground">{contract.classLevel}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {compensationLabel(contract.compensationType, contract.salaryAmount, contract.percentage)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatMoney(contract.monthlyPay)}</TableCell>
                          <TableCell className="text-right">{formatMoney(contract.totalPaidOut)}</TableCell>
                          <TableCell className="text-right">{formatMoney(contract.balanceDue)}</TableCell>
                          <TableCell>
                            <Badge variant={contract.isActive ? "default" : "secondary"}>
                              {contract.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(contract)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteId(contract.id)}>
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
            </TabsContent>

            <TabsContent value="teachers" className="mt-4 space-y-4">
              {filteredTeachers.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">No teacher payroll records yet.</div>
              ) : (
                filteredTeachers.map((teacher) => (
                  <Card key={teacher.teacherId} className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="font-semibold">{teacher.teacherName}</h3>
                        <p className="text-sm text-muted-foreground">{teacher.teacherEmail}</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Classes</p>
                          <p className="font-semibold">{teacher.classesCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Students</p>
                          <p className="font-semibold">{teacher.studentsCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Monthly Pay</p>
                          <p className="font-semibold">{formatMoney(teacher.monthlyPay)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Balance</p>
                          <p className="font-semibold">{formatMoney(teacher.balanceDue)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {teacher.contracts.map((contract) => (
                        <Badge key={contract.id} variant="outline">
                          {contract.className}: {formatMoney(contract.monthlyPay)}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Contract" : "Add Contract"}</DialogTitle>
            <DialogDescription>
              Choose the teacher, assign the class they teach, then set salary or percentage pay.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Teacher *</Label>
                <Select
                  value={teacherId}
                  onValueChange={(value) => {
                    setTeacherId(value)
                    setClassId("")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {teachers.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Class *</Label>
                <Select value={classId} onValueChange={setClassId} disabled={!teacherId}>
                  <SelectTrigger>
                    <SelectValue placeholder={teacherId ? "Select class" : "Select teacher first"} />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {teacherClasses.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.name}
                        {row.level ? ` (${row.level})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Pay Type *</Label>
              <Select value={compensationType} onValueChange={(value) => setCompensationType(value as CompensationType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="SALARY">Fixed Salary</SelectItem>
                  <SelectItem value="PERCENTAGE">Percentage of Class Revenue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {compensationType === "SALARY" ? (
              <div className="grid gap-2">
                <Label htmlFor="salary-amount">Monthly Salary *</Label>
                <Input
                  id="salary-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={salaryAmount}
                  onChange={(event) => setSalaryAmount(event.target.value)}
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="percentage-rate">Percentage of Class Revenue *</Label>
                <Input
                  id="percentage-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={percentage}
                  onChange={(event) => setPercentage(event.target.value)}
                />
              </div>
            )}

            <div className="rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                {compensationType === "SALARY" ? (
                  <DollarSign className="h-4 w-4 text-primary" />
                ) : (
                  <Percent className="h-4 w-4 text-primary" />
                )}
                <p className="font-medium">Pay Preview</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-md bg-background border p-3">
                  <p className="text-xs text-muted-foreground">Students</p>
                  <p className="text-xl font-bold">
                    {selectedClassStats && "studentsCount" in selectedClassStats ? selectedClassStats.studentsCount : 0}
                  </p>
                </div>
                <div className="rounded-md bg-background border p-3">
                  <p className="text-xs text-muted-foreground">Class Revenue (This Month)</p>
                  <p className="text-xl font-bold">
                    {formatMoney(
                      selectedClassStats && "classMonthlyCollected" in selectedClassStats
                        ? selectedClassStats.classMonthlyCollected
                        : 0,
                    )}
                  </p>
                </div>
                <div className="rounded-md bg-background border p-3">
                  <p className="text-xs text-muted-foreground">Monthly Pay</p>
                  <p className="text-xl font-bold">{formatMoney(previewMonthlyPay)}</p>
                </div>
              </div>
              {compensationType === "PERCENTAGE" && (
                <p className="text-xs text-muted-foreground mt-3">
                  Percentage contracts use this month&apos;s collected class revenue as the calculation base.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contract-note">Note</Label>
              <Input id="contract-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active Contract</p>
                <p className="text-xs text-muted-foreground">Inactive contracts stay in history but are excluded from active totals.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : editing ? "Save Changes" : "Create Contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailContract ? `${detailContract.teacherName} · ${detailContract.className}` : "Contract Details"}</DialogTitle>
            <DialogDescription>Pay breakdown and payout history.</DialogDescription>
          </DialogHeader>

          {loadingDetail || !detailContract ? (
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
                    <p className="text-xs text-muted-foreground">Pay Type</p>
                    <p className="font-semibold mt-2">
                      {compensationLabel(
                        detailContract.compensationType,
                        detailContract.salaryAmount,
                        detailContract.percentage,
                      )}
                    </p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Monthly Summary</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Students</p>
                        <p className="font-semibold">{detailContract.studentsCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Class Revenue</p>
                        <p className="font-semibold">{formatMoney(detailContract.classMonthlyCollected)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monthly Pay</p>
                        <p className="font-semibold">{formatMoney(detailContract.monthlyPay)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Balance</p>
                        <p className="font-semibold">{formatMoney(detailContract.balanceDue)}</p>
                      </div>
                    </div>
                  </Card>
                </div>
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

                {detailContract.payouts.length ? (
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
                      {detailContract.payouts.map((payout) => (
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
            <AlertDialogTitle>Delete contract?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the contract and its payout history. This action cannot be undone.
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
