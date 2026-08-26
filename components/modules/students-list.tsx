"use client"

import { useEffect, useState, useRef } from "react"
import { Plus, Pencil, Trash2, Search, Users, CalendarClock, GraduationCap, Upload, ReceiptText, Eye, EyeOff } from "lucide-react"
import * as XLSX from "xlsx"
import { isStudentNameHeader, normalizeImportHeader, parseStudentFullName } from "@/lib/student-import"

import { api } from "@/lib/api"
import { formatVisitDateInput, getNextSaturday } from "@/lib/visit-messages"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import PaymentReceiptDialog from "@/components/modules/payment-receipt-dialog"

type ClassOption = { id: string; name: string; level: string | null; isActive: boolean }
type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID"
type StudentRow = {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  gender: string | null
  feeAmount: number
  paymentStatus: PaymentStatus
  enrollmentStatus: "ENROLLED" | "VISIT_SCHEDULED"
  visitDate: string | null
  visitNote: string | null
  isActive: boolean
  isHidden: boolean
  classId: string | null
  class: { id: string; name: string; level: string | null; isActive: boolean } | null
  registeredById: string | null
  registeredBy: { id: string; name: string } | null
  totalPaid?: number
  remainingBalance?: number
  creditBalance?: number
  paymentCount?: number
  lastPaymentId?: string | null
}

const NO_CLASS_VALUE = "__none__"
const selectContentClass = "z-[200] bg-background border shadow-xl"

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function formatPersonName(firstName: string, lastName: string) {
  const format = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  return `${format(firstName)} ${format(lastName)}`.trim()
}

function paymentLabel(status: PaymentStatus) {
  if (status === "PAID") return "Paid"
  if (status === "PARTIAL") return "Partial"
  return "Unpaid"
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function formatVisitDisplay(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function buildStudentPayload(args: {
  firstName: string
  lastName: string
  email: string
  phone: string
  gender: string
  classId: string
  paymentStatus: PaymentStatus
  isActive: boolean
  enrollmentStatus: "ENROLLED" | "VISIT_SCHEDULED"
  visitDate: string
  visitNote: string
  paymentAmount?: string
  feeAmount: string
  paymentNote?: string
}) {
  const numericAmount = args.paymentAmount?.trim() ? Number(args.paymentAmount) : NaN
  const hasPayment = Number.isFinite(numericAmount) && numericAmount > 0
  const numericFeeAmount = args.feeAmount.trim() ? Number(args.feeAmount) : 0
  const normalizedFeeAmount = Number.isFinite(numericFeeAmount) && numericFeeAmount >= 0 ? numericFeeAmount : 0
  const derivedStatus =
    args.enrollmentStatus === "VISIT_SCHEDULED"
      ? "UNPAID"
      : hasPayment
        ? normalizedFeeAmount > numericAmount
          ? "PARTIAL"
          : "PAID"
        : args.paymentStatus

  return {
    firstName: args.firstName.trim(),
    lastName: args.lastName.trim(),
    email: args.email.trim() ? args.email.trim() : null,
    phone: args.phone.trim() ? args.phone.trim() : null,
    gender: args.gender.trim() ? args.gender.trim() : null,
    classId: args.classId === NO_CLASS_VALUE ? null : args.classId,
    feeAmount: normalizedFeeAmount,
    paymentStatus: derivedStatus,
    isActive: args.isActive,
    enrollmentStatus: args.enrollmentStatus,
    visitDate: args.enrollmentStatus === "VISIT_SCHEDULED" ? args.visitDate : null,
    visitNote: args.enrollmentStatus === "VISIT_SCHEDULED" && args.visitNote.trim() ? args.visitNote.trim() : null,
    ...(hasPayment && args.enrollmentStatus !== "VISIT_SCHEDULED"
      ? {
          paymentAmount: numericAmount,
          paymentNote: args.paymentNote?.trim() ? args.paymentNote.trim() : null,
        }
      : {}),
  }
}

type PaginatedStudentsResponse = {
  items: StudentRow[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export default function StudentsList() {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [userRole, setUserRole] = useState<"ADMIN" | "REGISTRAR" | null>(null)

  const isRegistrar = userRole === "REGISTRAR"
  const isAdmin = userRole === "ADMIN"

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 })
  const [filterClassId, setFilterClassId] = useState<string>("all")
  const [filterPayment, setFilterPayment] = useState<string>("all")
  const [filterEnrollment, setFilterEnrollment] = useState<string>("all")
  const [filterVisibility, setFilterVisibility] = useState<string>("all")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StudentRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [gender, setGender] = useState("")
  const [classId, setClassId] = useState<string>(NO_CLASS_VALUE)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("UNPAID")
  const [enrollmentStatus, setEnrollmentStatus] = useState<"ENROLLED" | "VISIT_SCHEDULED">("ENROLLED")
  const [visitDate, setVisitDate] = useState(formatVisitDateInput(getNextSaturday()))
  const [visitNote, setVisitNote] = useState("")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [feeAmount, setFeeAmount] = useState("")
  const [paymentNote, setPaymentNote] = useState("")
  const [isActive, setIsActive] = useState(true)

  const [quickPayOpen, setQuickPayOpen] = useState(false)
  const [quickPayStudent, setQuickPayStudent] = useState<StudentRow | null>(null)
  const [quickPayAmount, setQuickPayAmount] = useState("")
  const [quickPayFeeAmount, setQuickPayFeeAmount] = useState("")
  const [quickPayNote, setQuickPayNote] = useState("")
  const [quickPaySaving, setQuickPaySaving] = useState(false)
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({})
  const [visibilityUpdating, setVisibilityUpdating] = useState<Record<string, boolean>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [bulkData, setBulkData] = useState<any[]>([])
  const [bulkClassId, setBulkClassId] = useState<string>(NO_CLASS_VALUE)
  const [bulkSaving, setBulkSaving] = useState(false)

  const resetForm = () => {
    setEditing(null)
    setFirstName("")
    setLastName("")
    setEmail("")
    setPhone("")
    setGender("")
    setClassId(NO_CLASS_VALUE)
    setPaymentStatus("UNPAID")
    setEnrollmentStatus("ENROLLED")
    setVisitDate(formatVisitDateInput(getNextSaturday()))
    setVisitNote("")
    setPaymentAmount("")
    setFeeAmount("")
    setPaymentNote("")
    setIsActive(true)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (student: StudentRow) => {
    setEditing(student)
    setFirstName(student.firstName ?? "")
    setLastName(student.lastName ?? "")
    setEmail(student.email ?? "")
    setPhone(student.phone ?? "")
    setGender(student.gender ?? "")
    setClassId(student.classId ?? NO_CLASS_VALUE)
    setPaymentStatus(student.paymentStatus ?? "UNPAID")
    setEnrollmentStatus(student.enrollmentStatus ?? "ENROLLED")
    setVisitDate(
      student.visitDate
        ? formatVisitDateInput(new Date(student.visitDate))
        : formatVisitDateInput(getNextSaturday()),
    )
    setVisitNote(student.visitNote ?? "")
    setPaymentAmount("")
    setFeeAmount(student.feeAmount > 0 ? String(student.feeAmount) : "")
    setPaymentNote("")
    setIsActive(Boolean(student.isActive))
    setFormOpen(true)
  }

  const fetchClasses = async () => {
    try {
      const res = await api.get<ClassOption[]>("/api/classes?assignmentEligible=true")
      setClasses(res.data)
    } catch (e: any) {
      toast({ title: "Failed to load classes", description: getErrorMessage(e), variant: "destructive" })
    }
  }

  const fetchStudents = async (targetPage = page) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("page", String(targetPage))
      params.set("pageSize", "50")
      if (filterClassId !== "all") params.set("classId", filterClassId)
      if (filterPayment !== "all") params.set("paymentStatus", filterPayment)
      if (filterEnrollment !== "all") params.set("enrollmentStatus", filterEnrollment)
      params.set("visibility", filterVisibility)
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim())

      const res = await api.get<PaginatedStudentsResponse>(`/api/students?${params.toString()}`)
      setStudents(res.data.items)
      setPagination(res.data.pagination)
      setPage(res.data.pagination.page)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 350)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ role: "ADMIN" | "REGISTRAR" }>("/api/auth/me")
        if (res.data.role === "ADMIN" || res.data.role === "REGISTRAR") {
          setUserRole(res.data.role)
        }
      } catch {
        // role-gated UI falls back to admin view until loaded
      }
    })()
    void fetchClasses()
    void fetchStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPage(1)
    void fetchStudents(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClassId, filterPayment, filterEnrollment, filterVisibility, debouncedSearch])

  const filtered = students

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: "First and last name are required", variant: "destructive" })
      return
    }

    if (enrollmentStatus === "VISIT_SCHEDULED" && !phone.trim()) {
      toast({
        title: "Phone required",
        description: "Visit scheduled students need a phone number for WhatsApp messages.",
        variant: "destructive",
      })
      return
    }

    if (enrollmentStatus === "VISIT_SCHEDULED" && !visitDate.trim()) {
      toast({ title: "Visit date required", description: "Choose when the student plans to visit.", variant: "destructive" })
      return
    }

    const numericFeeAmount = feeAmount.trim() ? Number(feeAmount) : 0
    if (!Number.isFinite(numericFeeAmount) || numericFeeAmount < 0) {
      toast({ title: "Enter a valid total fee", variant: "destructive" })
      return
    }

    if (paymentAmount.trim() && numericFeeAmount <= 0) {
      toast({
        title: "Enter the total fee",
        description: "The total fee is needed to calculate the remaining balance.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      let savedPaymentId: string | null = null
      const payload = buildStudentPayload({
        firstName,
        lastName,
        email,
        phone,
        gender,
        classId,
        paymentStatus,
        isActive,
        enrollmentStatus,
        visitDate,
        visitNote,
        feeAmount,
        paymentAmount,
        paymentNote,
      })

      if (editing) {
        const patchPayload = buildStudentPayload({
          firstName,
          lastName,
          email,
          phone,
          gender,
          classId,
          paymentStatus,
          isActive,
          enrollmentStatus,
          visitDate,
          visitNote,
          feeAmount,
        })
        await api.patch(`/api/students/${editing.id}`, patchPayload)

        const numericAmount = paymentAmount.trim() ? Number(paymentAmount) : NaN
        if (Number.isFinite(numericAmount) && numericAmount > 0) {
          const paymentResponse = await api.post("/api/payments", {
            studentId: editing.id,
            amount: numericAmount,
            feeAmount: numericFeeAmount,
            note: paymentNote.trim() ? paymentNote.trim() : null,
          })
          savedPaymentId = typeof paymentResponse.data?.id === "string" ? paymentResponse.data.id : null
          toast({ title: "Student updated", description: "Payment recorded successfully." })
        } else {
          toast({ title: "Student updated successfully" })
        }
      } else {
        const res = await api.post("/api/students", payload)
        savedPaymentId = typeof res.data?.paymentId === "string" ? res.data.paymentId : null
        const confirmation = res.data?.whatsappConfirmation
        if (enrollmentStatus === "VISIT_SCHEDULED") {
          if (confirmation?.status === "SENT") {
            toast({
              title: "Prospect registered",
              description: "WhatsApp confirmation sent with the visit date.",
            })
          } else if (confirmation?.status === "FAILED") {
            const detail =
              typeof confirmation?.error === "string" && confirmation.error.includes("your-meta-whatsapp")
                ? "WhatsApp is not configured. Add real WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env."
                : typeof confirmation?.error === "string" && confirmation.error.length < 120
                  ? confirmation.error
                  : "WhatsApp could not send. Check .env WhatsApp settings and use phone with country code (e.g. 252...)."
            toast({
              title: "Prospect registered",
              description: `Saved, but WhatsApp confirmation failed. ${detail}`,
              variant: "destructive",
            })
          } else {
            toast({
              title: "Prospect registered",
              description: "Visit scheduled. WhatsApp reminder will be sent on that day.",
            })
          }
        } else {
          toast({ title: "Student created successfully" })
        }
      }

      setFormOpen(false)
      resetForm()
      await fetchStudents()
      if (savedPaymentId && isAdmin) setReceiptPaymentId(savedPaymentId)
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 404) {
        toast({ title: "Student not found", description: "Refreshing student list...", variant: "destructive" })
        setFormOpen(false)
        resetForm()
        await fetchStudents()
      } else {
        toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
      }
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const prev = students
    setStudents((cur) => cur.filter((s) => s.id !== deleteId))
    try {
      await api.delete(`/api/students/${deleteId}`)
      toast({ title: "Student deleted successfully" })
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 404) {
        toast({ title: "Student not found", description: "Refreshing student list...", variant: "destructive" })
        await fetchStudents()
      } else {
        setStudents(prev)
        toast({ title: "Delete failed", description: getErrorMessage(e), variant: "destructive" })
      }
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const toggleStudentStatus = async (student: StudentRow) => {
    if (statusUpdating[student.id]) return
    const nextIsActive = !student.isActive
    const prevIsActive = student.isActive

    setStatusUpdating((cur) => ({ ...cur, [student.id]: true }))
    setStudents((cur) => cur.map((s) => (s.id === student.id ? { ...s, isActive: nextIsActive } : s)))

    try {
      await api.patch(`/api/students/${student.id}`, {
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email ?? null,
        phone: student.phone ?? null,
        gender: student.gender ?? null,
        classId: student.classId,
        paymentStatus: student.paymentStatus,
        enrollmentStatus: student.enrollmentStatus ?? "ENROLLED",
        visitDate: student.visitDate,
        visitNote: student.visitNote,
        isActive: nextIsActive,
      })
      toast({ title: nextIsActive ? "Student is now ACTIVE" : "Student is now INACTIVE" })
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 404) {
        // Student no longer exists – refresh list to reflect backend
        setStudents((cur) => cur.filter((s) => s.id !== student.id))
        toast({ title: "Student not found", description: "Refreshing student list...", variant: "destructive" })
        await fetchStudents()
      } else {
        setStudents((cur) => cur.map((s) => (s.id === student.id ? { ...s, isActive: prevIsActive } : s)))
        toast({ title: "Update failed", description: getErrorMessage(e), variant: "destructive" })
      }
    } finally {
      setStatusUpdating((cur) => {
        const next = { ...cur }
        delete next[student.id]
        return next
      })
    }
  }

  const toggleStudentVisibility = async (student: StudentRow) => {
    if (visibilityUpdating[student.id]) return
    const nextIsHidden = !student.isHidden
    const previousIsHidden = student.isHidden

    setVisibilityUpdating((cur) => ({ ...cur, [student.id]: true }))
    setStudents((cur) => cur.map((row) => (row.id === student.id ? { ...row, isHidden: nextIsHidden } : row)))

    try {
      await api.patch(`/api/students/${student.id}/visibility`, { isHidden: nextIsHidden })
      toast({
        title: nextIsHidden ? "Student hidden" : "Student visible again",
        description: nextIsHidden
          ? "The student is hidden from the class and teacher. Their class assignment is saved."
          : "The student is back in their previous class and is visible to the teacher.",
      })

      if (filterVisibility !== "all") await fetchStudents()
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 404) {
        setStudents((cur) => cur.filter((row) => row.id !== student.id))
        toast({ title: "Student not found", description: "Refreshing student list...", variant: "destructive" })
        await fetchStudents()
      } else {
        setStudents((cur) => cur.map((row) => (row.id === student.id ? { ...row, isHidden: previousIsHidden } : row)))
        toast({ title: "Visibility update failed", description: getErrorMessage(e), variant: "destructive" })
      }
    } finally {
      setVisibilityUpdating((cur) => {
        const next = { ...cur }
        delete next[student.id]
        return next
      })
    }
  }

  const togglePaymentStatus = (student: StudentRow) => {
    if (student.paymentStatus !== "PAID") {
      setQuickPayStudent(student)
      setQuickPayAmount("")
      setQuickPayFeeAmount(student.feeAmount > 0 ? String(student.feeAmount) : "")
      setQuickPayNote("")
      setQuickPayOpen(true)
      return
    }

    toast({ title: "Account is fully paid", description: "Payment status is calculated from the saved transactions." })
  }

  const submitQuickPayment = async () => {
    if (!quickPayStudent) return
    const numericAmount = Number(quickPayAmount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
      return
    }
    const numericFeeAmount = Number(quickPayFeeAmount)
    if (!Number.isFinite(numericFeeAmount) || numericFeeAmount <= 0) {
      toast({ title: "Enter the total fee", variant: "destructive" })
      return
    }

    setQuickPaySaving(true)
    try {
      const paymentResponse = await api.post("/api/payments", {
        studentId: quickPayStudent.id,
        amount: numericAmount,
        feeAmount: numericFeeAmount,
        note: quickPayNote.trim() ? quickPayNote.trim() : null,
      })
      toast({
        title: "Payment recorded",
        description: `${formatPersonName(quickPayStudent.firstName, quickPayStudent.lastName)} account balance was updated.`,
      })
      setQuickPayOpen(false)
      setQuickPayStudent(null)
      await fetchStudents()
      if (typeof paymentResponse.data?.id === "string") setReceiptPaymentId(paymentResponse.data.id)
    } catch (e: any) {
      toast({ title: "Payment failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setQuickPaySaving(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const parsedStudents: Array<{ firstName: string; lastName: string; phone: string | null }> = []

        for (const sheetName of wb.SheetNames) {
          const rawData: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 })
          let headerRowIndex = -1
          let nameColIndex = -1
          let phoneColIndex = -1

          for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i]
            if (!Array.isArray(row)) continue
            for (let j = 0; j < row.length; j++) {
              const cellValue = normalizeImportHeader(row[j])
              if (isStudentNameHeader(cellValue)) {
                headerRowIndex = i
                nameColIndex = j
              }
              if (cellValue === "phone" || cellValue === "phone number" || cellValue === "mobile") {
                phoneColIndex = j
              }
            }
            if (headerRowIndex !== -1) break
          }

          const firstDataRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0
          for (let i = firstDataRow; i < rawData.length; i++) {
            const row = rawData[i]
            if (!Array.isArray(row)) continue

            const rawName =
              nameColIndex >= 0
                ? row[nameColIndex]
                : row
                    .filter((cell) => {
                      const value = String(cell ?? "").trim()
                      return value && /[a-z]/i.test(value) && !value.includes("@") && !isStudentNameHeader(value)
                    })
                    .join(" ")
            const parsedName = parseStudentFullName(rawName)
            if (!parsedName) continue

            const phone = phoneColIndex >= 0 ? String(row[phoneColIndex] ?? "").trim() : null
            parsedStudents.push({ ...parsedName, phone: phone || null })
          }
        }

        if (parsedStudents.length === 0) {
          toast({ title: "No students found", description: "The file does not contain readable student names.", variant: "destructive" })
          return
        }

        const uniqueStudents = Array.from(
          new Map(
            parsedStudents.map((student) => [
              `${student.firstName} ${student.lastName}`.trim().toLowerCase(),
              student,
            ]),
          ).values(),
        )

        // Sort A-Z by first name, then last name
        uniqueStudents.sort((a, b) => {
          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
          return nameA.localeCompare(nameB)
        })

        setBulkData(uniqueStudents)
        setBulkClassId(NO_CLASS_VALUE)
        setBulkImportOpen(true)
      } catch (error) {
        console.error(error)
        toast({ title: "Failed to parse file", description: "Make sure it is a valid Excel or CSV file.", variant: "destructive" })
      }
    }
    reader.readAsBinaryString(file)
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const confirmBulkImport = async () => {
    setBulkSaving(true)
    try {
      const payload = bulkData.map(s => ({
        ...s,
        classId: bulkClassId === NO_CLASS_VALUE ? null : bulkClassId
      }))

      const res = await api.post("/api/students/bulk", { students: payload })
      toast({ title: "Bulk Import Successful", description: `Successfully imported ${res.data.count} students.` })
      setBulkImportOpen(false)
      setBulkData([])
      await fetchStudents()
    } catch (e: any) {
      toast({ title: "Import failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setBulkSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#003D9E]/10 via-background to-[#EC4724]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#003D9E]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/15 px-3 py-1 text-xs font-medium text-primary">
              <Users className="w-3.5 h-3.5" />
              {pagination.total.toLocaleString()} student{pagination.total === 1 ? "" : "s"}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {isRegistrar ? "Student Registration" : "Student Management"}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              {isRegistrar
                ? "Register students and view only the records you created."
                : "Manage student records, class assignments, and payments."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
            <input type="file" ref={fileInputRef} accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="lg" className="w-full sm:w-auto rounded-full shadow-sm gap-2 px-6 bg-background/50 hover:bg-background">
              <Upload className="w-5 h-5" /> Upload Excel
            </Button>
            <Button onClick={openCreate} size="lg" className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6">
              <Plus className="w-5 h-5" /> Add Student
            </Button>
          </div>
        </div>
      </div>

      <Card className="p-4 sm:p-5 border-muted/50 shadow-sm gap-0">
        <div className="flex flex-col lg:flex-row gap-4 w-full">
          <div className="flex flex-1 flex-col gap-2 min-w-0 w-full lg:basis-0">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Search</Label>
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name, email, or phone..."
                className="w-full pl-10 h-11 rounded-lg bg-background border-muted shadow-sm focus-visible:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 min-w-0 w-full lg:basis-0">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Class</Label>
            <Select value={filterClassId} onValueChange={setFilterClassId}>
              <SelectTrigger className="h-11 w-full rounded-lg bg-background border-muted shadow-sm">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent className={selectContentClass} position="popper">
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 flex-col gap-2 min-w-0 w-full lg:basis-0">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Registration</Label>
            <Select value={filterEnrollment} onValueChange={setFilterEnrollment}>
              <SelectTrigger className="h-11 w-full rounded-lg bg-background border-muted shadow-sm">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent className={selectContentClass} position="popper">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ENROLLED">Enrolled</SelectItem>
                <SelectItem value="VISIT_SCHEDULED">Visit Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isAdmin && (
            <div className="flex flex-1 flex-col gap-2 min-w-0 w-full lg:basis-0">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment</Label>
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="h-11 w-full rounded-lg bg-background border-muted shadow-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent className={selectContentClass} position="popper">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {isAdmin && (
            <div className="flex flex-1 flex-col gap-2 min-w-0 w-full lg:basis-0">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visibility</Label>
              <Select value={filterVisibility} onValueChange={setFilterVisibility}>
                <SelectTrigger className="h-11 w-full rounded-lg bg-background border-muted shadow-sm">
                  <SelectValue placeholder="All students" />
                </SelectTrigger>
                <SelectContent className={selectContentClass} position="popper">
                  <SelectItem value="all">All Students</SelectItem>
                  <SelectItem value="visible">Visible</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading students...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm bg-destructive/5 text-destructive border-destructive/20 shadow-sm">{error}</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <div className="p-4 rounded-full bg-muted">
            <Search className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-lg font-medium">No students found</p>
          <p className="text-sm">Try adjusting your filters or search query.</p>
        </Card>
      ) : (
        <div className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[240px]">Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell min-w-[140px]">Registration</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell min-w-[140px]">Class</TableHead>
                  {isAdmin && (
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[140px] text-right pr-6">
                      Balance / Due
                    </TableHead>
                  )}
                  {isAdmin && (
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell min-w-[100px] text-right pr-6">
                      Amount Paid
                    </TableHead>
                  )}
                  {isAdmin && (
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center w-[120px]">Payment</TableHead>
                  )}
                  {isAdmin && (
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center w-[120px]">Status</TableHead>
                  )}
                  <TableHead className="text-right pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((student) => (
                  <TableRow
                    key={student.id}
                    className={`group hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0 ${student.isHidden ? "bg-slate-50/80 text-muted-foreground dark:bg-slate-900/30" : ""}`}
                  >
                    <TableCell className="py-4 pl-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-base text-foreground font-semibold tracking-tight">
                          <span>{formatPersonName(student.firstName, student.lastName)}</span>
                          {student.isHidden && (
                            <Badge variant="secondary" className="rounded-full bg-slate-200 text-slate-700 border border-slate-300 text-[10px] uppercase tracking-wide dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                              Hidden
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                          <span className="truncate max-w-[220px]">{student.email || "No email"}</span>
                          {student.phone && (
                            <>
                              <span className="hidden sm:inline text-muted-foreground/40">•</span>
                              <span className="font-mono">{student.phone}</span>
                            </>
                          )}
                        </div>
                        <div className="md:hidden pt-1 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="rounded-full font-normal capitalize">
                            {student.class?.name ?? "Unassigned"}
                          </Badge>
                          {student.enrollmentStatus === "VISIT_SCHEDULED" && (
                            <Badge className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/40">
                              Visit {formatVisitDisplay(student.visitDate)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell py-4 align-middle">
                      {student.enrollmentStatus === "VISIT_SCHEDULED" ? (
                        <div className="space-y-1">
                          <Badge className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/40">
                            Visit Scheduled
                          </Badge>
                          <p className="text-xs text-muted-foreground">{formatVisitDisplay(student.visitDate)}</p>
                        </div>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/5">
                          Enrolled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-4 align-middle">
                      {student.class?.name ? (
                        <Badge variant="outline" className="rounded-full font-medium capitalize border-primary/20 text-primary bg-primary/5">
                          {student.class.name}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Unassigned</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="py-4 align-middle font-semibold tabular-nums text-right pr-6">
                        {(student.creditBalance ?? 0) > 0 ? (
                          <span className="text-emerald-700">Credit {formatCurrency(student.creditBalance ?? 0)}</span>
                        ) : (student.remainingBalance ?? 0) > 0 ? (
                          <span className="text-[#EC4724]">{formatCurrency(student.remainingBalance ?? 0)} Due</span>
                        ) : (
                          <span className="text-emerald-700">{formatCurrency(0)}</span>
                        )}
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell className="hidden lg:table-cell py-4 align-middle font-semibold tabular-nums text-[#003D9E] text-right pr-6">
                        {formatCurrency(student.totalPaid ?? 0)}
                      </TableCell>
                    )}
                    {isAdmin && (
                    <TableCell className="py-4 align-middle text-center">
                      <Badge
                        asChild
                        variant="secondary"
                        className={`inline-flex min-w-[88px] justify-center rounded-full shadow-none px-3 py-1 text-xs font-semibold transition ${
                          student.paymentStatus === "PAID"
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            : student.paymentStatus === "PARTIAL"
                              ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 dark:border-blue-500/40"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60 dark:border-amber-500/40"
                        } cursor-pointer`}
                      >
                        <button
                          type="button"
                          onClick={() => togglePaymentStatus(student)}
                          title={student.paymentStatus === "PAID" ? "Fully paid" : "Click to record payment"}
                        >
                          {paymentLabel(student.paymentStatus)}
                        </button>
                      </Badge>
                    </TableCell>
                    )}
                    {isAdmin && (
                    <TableCell className="py-4 align-middle text-center">
                      <Badge
                        asChild
                        variant="secondary"
                        className={`inline-flex min-w-[88px] justify-center rounded-full shadow-none px-3 py-1 text-xs font-semibold transition ${
                          student.isActive
                            ? "bg-[#003D9E]/10 text-[#003D9E] hover:bg-[#003D9E]/15 border border-[#003D9E]/20"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                        } ${statusUpdating[student.id] ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleStudentStatus(student)}
                          disabled={statusUpdating[student.id]}
                          aria-pressed={student.isActive}
                          title="Click to toggle active status"
                        >
                          {student.isActive ? "Active" : "Inactive"}
                        </button>
                      </Badge>
                    </TableCell>
                    )}
                    <TableCell className="text-right py-4 pr-6 align-middle">
                      <div className="flex justify-end gap-1">
                        {isAdmin && student.lastPaymentId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setReceiptPaymentId(student.lastPaymentId ?? null)}
                            aria-label="View latest payment receipt"
                            title="View latest payment receipt"
                            className="h-8 w-8 text-muted-foreground hover:text-[#003D9E] hover:bg-blue-50 rounded-full transition-colors"
                          >
                            <ReceiptText className="w-4 h-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void toggleStudentVisibility(student)}
                            disabled={visibilityUpdating[student.id]}
                            aria-label={student.isHidden ? "Unhide student" : "Hide student"}
                            title={student.isHidden ? "Unhide student and restore class visibility" : "Hide student from class and teacher"}
                            className={`h-8 w-8 rounded-full transition-colors ${
                              student.isHidden
                                ? "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                                : "text-muted-foreground hover:text-amber-700 hover:bg-amber-50"
                            } ${visibilityUpdating[student.id] ? "opacity-50 cursor-wait" : ""}`}
                          >
                            {student.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(student)}
                          aria-label="Edit student"
                          className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(student.id)}
                          aria-label="Delete student"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4 border-t bg-muted/20">
            <p className="text-sm text-muted-foreground">
              {pagination.total === 0
                ? "No students"
                : `Showing ${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total.toLocaleString()} · Page ${pagination.page}/${pagination.totalPages}`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || loading}
                onClick={() => void fetchStudents(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => void fetchStudents(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Student" : "Add Student"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update student details."
                : "Register a full student or a prospect who will visit later."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-3">
              <Label>Registration Type</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEnrollmentStatus("ENROLLED")}
                  className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                    enrollmentStatus === "ENROLLED"
                      ? "border-[#003D9E] bg-[#003D9E]/5"
                      : "border-muted hover:bg-muted/30"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${enrollmentStatus === "ENROLLED" ? "bg-[#003D9E] text-white" : "bg-muted text-muted-foreground"}`}>
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Enrolled Student</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Fully registered at Deero Institute</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setEnrollmentStatus("VISIT_SCHEDULED")}
                  className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                    enrollmentStatus === "VISIT_SCHEDULED"
                      ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 dark:border-amber-500/70"
                      : "border-muted hover:bg-muted/30"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${enrollmentStatus === "VISIT_SCHEDULED" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Visit Scheduled</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      e.g. &quot;I will come Saturday to learn more&quot;
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Phone {enrollmentStatus === "VISIT_SCHEDULED" && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={enrollmentStatus === "VISIT_SCHEDULED" ? "Required for WhatsApp" : "optional"}
                />
              </div>
            </div>

            {enrollmentStatus === "VISIT_SCHEDULED" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-4 dark:border-amber-500/40 dark:bg-amber-950/50">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Visit details</p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/90">
                    WhatsApp confirmation is sent now. On the visit day, the system sends a reminder automatically.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitDate">Visit Date</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="visitDate"
                      type="date"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full shrink-0"
                      onClick={() => setVisitDate(formatVisitDateInput(getNextSaturday()))}
                    >
                      This Saturday
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitNote">Note</Label>
                  <Input
                    id="visitNote"
                    value={visitNote}
                    onChange={(e) => setVisitNote(e.target.value)}
                    placeholder='e.g. "Does not know Deero Institute yet, will visit Saturday"'
                    className="bg-background"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="gender" className="w-full bg-background">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass} position="popper">
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass} position="popper">
                    <SelectItem value={NO_CLASS_VALUE}>Unassigned</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {enrollmentStatus === "ENROLLED" && (
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {editing ? (editing.paymentStatus === "PAID" ? "Add Payment" : "Record Fee Payment") : "Student Fee"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editing
                      ? "Update the total fee or enter a new installment. The remaining balance is calculated automatically."
                      : "Enter the total fee expected. If the student paid now, also enter the amount received."}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="feeAmount">Total Fee (USD)</Label>
                    <Input
                      id="feeAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value)}
                      placeholder="e.g. 55"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentAmount">Paid Now (USD)</Label>
                    <Input
                      id="paymentAmount"
                      type="number"
                      min="1"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="e.g. 50"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="paymentNote">
                      Payment note <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="paymentNote"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="e.g. March fee"
                      className="bg-background"
                    />
                  </div>
                </div>
                {editing && (editing.totalPaid ?? 0) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Total paid so far: <span className="font-semibold text-[#003D9E]">{formatCurrency(editing.totalPaid ?? 0)}</span>
                  </p>
                )}
              </div>
            )}

            {enrollmentStatus === "ENROLLED" && isAdmin && (
                <div className="flex items-center justify-between rounded-lg border p-3 h-[72px]">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Enable or disable this student.</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
            )}

            {enrollmentStatus === "ENROLLED" && !isAdmin && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Student will be active after registration.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}

            {enrollmentStatus === "VISIT_SCHEDULED" && isAdmin && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Keep this prospect visible in the list.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving} className="rounded-full">
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving...
                </>
              ) : editing ? (
                "Save Changes"
              ) : enrollmentStatus === "VISIT_SCHEDULED" ? (
                "Register Visit"
              ) : (
                "Create Student"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quickPayOpen} onOpenChange={setQuickPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {quickPayStudent
                ? `Enter the fee amount for ${formatPersonName(quickPayStudent.firstName, quickPayStudent.lastName)}.`
                : "Enter payment details."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quickPayFeeAmount">Total Fee (USD)</Label>
              <Input
                id="quickPayFeeAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={quickPayFeeAmount}
                onChange={(e) => setQuickPayFeeAmount(e.target.value)}
                placeholder="e.g. 55"
                className="h-11 bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quickPayAmount">Paid Now (USD)</Label>
              <Input
                id="quickPayAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={quickPayAmount}
                onChange={(e) => setQuickPayAmount(e.target.value)}
                placeholder="e.g. 50"
                className="h-11 bg-background"
              />
            </div>
            {quickPayStudent && (
              <p className="text-sm text-muted-foreground">
                Paid so far: <span className="font-semibold text-[#003D9E]">{formatCurrency(quickPayStudent.totalPaid ?? 0)}</span>
                {quickPayStudent.remainingBalance ? ` | Balance: ${formatCurrency(quickPayStudent.remainingBalance)}` : ""}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="quickPayNote">Note (optional)</Label>
              <Input
                id="quickPayNote"
                value={quickPayNote}
                onChange={(e) => setQuickPayNote(e.target.value)}
                placeholder="e.g. Registration fee"
                className="h-11 bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setQuickPayOpen(false)} disabled={quickPaySaving}>
              Cancel
            </Button>
            <Button onClick={submitQuickPayment} disabled={quickPaySaving} className="rounded-full px-6">
              {quickPaySaving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving...
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>This action can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={bulkImportOpen} onOpenChange={(open) => !open && setBulkImportOpen(false)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Import</DialogTitle>
            <DialogDescription>
              We found {bulkData.length} student{bulkData.length !== 1 && "s"} in your file. 
              They will be registered as <strong>Enrolled</strong> and <strong>Unpaid</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Assign to Class</Label>
              <Select value={bulkClassId} onValueChange={setBulkClassId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No Class" />
                </SelectTrigger>
                <SelectContent className={selectContentClass} position="popper">
                  <SelectItem value={NO_CLASS_VALUE}>-- Select Class --</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the class that all {bulkData.length} students belong to.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
              <p className="text-xs font-semibold text-muted-foreground mb-2">PREVIEW (First 5 records)</p>
              {bulkData.slice(0, 5).map((s, i) => (
                <div key={i} className="text-sm flex items-center justify-between">
                  <span>{s.firstName} {s.lastName}</span>
                  {s.phone && <span className="text-xs text-muted-foreground">{s.phone}</span>}
                </div>
              ))}
              {bulkData.length > 5 && (
                <p className="text-xs text-muted-foreground italic pt-2">...and {bulkData.length - 5} more.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBulkImportOpen(false)} disabled={bulkSaving}>
              Cancel
            </Button>
            <Button onClick={confirmBulkImport} disabled={bulkSaving || bulkClassId === NO_CLASS_VALUE}>
              {bulkSaving ? (
                <>
                  <Spinner className="mr-2" />
                  Importing...
                </>
              ) : (
                "Confirm Import"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentReceiptDialog
        paymentId={receiptPaymentId}
        open={Boolean(receiptPaymentId)}
        onOpenChange={(open) => !open && setReceiptPaymentId(null)}
      />
    </div>
  )
}
