"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Pencil, Trash2, Search, GraduationCap, Mail } from "lucide-react"

import { api } from "@/lib/api"
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

type ClassOption = { id: string; name: string; level: string | null; isActive: boolean }
type TeacherRow = {
  id: string
  name: string
  email: string
  isActive: boolean
  classes: Array<{ id: string; name: string; level: string | null }>
}

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function formatPersonName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function TeachersList() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TeacherRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({})

  const resetForm = () => {
    setEditing(null)
    setName("")
    setEmail("")
    setPassword("")
    setIsActive(true)
    setSelectedClassIds([])
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (teacher: TeacherRow) => {
    setEditing(teacher)
    setName(teacher.name ?? "")
    setEmail(teacher.email ?? "")
    setPassword("")
    setIsActive(Boolean(teacher.isActive))
    setSelectedClassIds(teacher.classes.map((c) => c.id))
    setFormOpen(true)
  }

  const fetchClasses = async () => {
    try {
      const res = await api.get<ClassOption[]>("/api/classes")
      setClasses(res.data)
    } catch (e: any) {
      toast({ title: "Failed to load classes", description: getErrorMessage(e), variant: "destructive" })
    }
  }

  const fetchTeachers = async (targetPage = page) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        includeInactive: "true",
        page: String(targetPage),
        pageSize: "50",
      })
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim())
      const res = await api.get<{ items: TeacherRow[]; pagination: typeof pagination }>(`/api/teachers?${params.toString()}`)
      setTeachers(res.data.items)
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
    void fetchClasses()
  }, [])

  useEffect(() => {
    setPage(1)
    void fetchTeachers(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const filtered = teachers
  const activeCount = teachers.filter((t) => t.isActive).length

  const toggleClass = (classId: string) => {
    setSelectedClassIds((current) => (current.includes(classId) ? current.filter((x) => x !== classId) : [...current, classId]))
  }

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" })
      return
    }

    if (!editing && password.trim().length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim(),
        classIds: selectedClassIds,
        isActive,
      }
      if (password.trim()) payload.password = password.trim()

      if (editing) {
        await api.patch(`/api/teachers/${editing.id}`, payload)
        toast({ title: "Teacher updated successfully" })
      } else {
        await api.post("/api/teachers", payload)
        toast({ title: "Teacher created successfully" })
      }

      setFormOpen(false)
      resetForm()
      await fetchTeachers()
    } catch (e: any) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/teachers/${deleteId}`)
      toast({ title: "Teacher deleted successfully" })
      await fetchTeachers()
    } catch (e: any) {
      toast({ title: "Delete failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const toggleTeacherStatus = async (teacher: TeacherRow) => {
    if (statusUpdating[teacher.id]) return
    const nextIsActive = !teacher.isActive
    const prevIsActive = teacher.isActive

    setStatusUpdating((cur) => ({ ...cur, [teacher.id]: true }))
    setTeachers((cur) => cur.map((t) => (t.id === teacher.id ? { ...t, isActive: nextIsActive } : t)))

    try {
      await api.patch(`/api/teachers/${teacher.id}`, {
        name: teacher.name,
        email: teacher.email,
        isActive: nextIsActive,
      })
      toast({ title: nextIsActive ? "Teacher is now ACTIVE" : "Teacher is now INACTIVE" })
    } catch (e: any) {
      setTeachers((cur) => cur.map((t) => (t.id === teacher.id ? { ...t, isActive: prevIsActive } : t)))
      toast({ title: "Update failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setStatusUpdating((cur) => {
        const next = { ...cur }
        delete next[teacher.id]
        return next
      })
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#003D9E]/10 via-background to-[#EC4724]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#003D9E]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/15 px-3 py-1 text-xs font-medium text-primary">
                <GraduationCap className="w-3.5 h-3.5" />
                {pagination.total.toLocaleString()} teacher{pagination.total === 1 ? "" : "s"}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
                {activeCount} active
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Teacher Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Create teachers, manage access, and assign classes.
            </p>
          </div>
          <Button onClick={openCreate} size="lg" className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6 shrink-0">
            <Plus className="w-5 h-5" /> Add Teacher
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-5 border-muted/50 shadow-sm">
        <div className="max-w-xl space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Search Teachers</Label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-10 h-11 rounded-lg bg-background border-muted shadow-sm focus-visible:ring-primary/20"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading teachers...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm bg-destructive/5 text-destructive border-destructive/20 shadow-sm">{error}</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <div className="p-4 rounded-full bg-muted">
            <Search className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-lg font-medium">No teachers found</p>
          <p className="text-sm">Try adjusting your search.</p>
        </Card>
      ) : (
        <div className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[220px]">Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell min-w-[200px]">Email</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[180px]">Classes</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center w-[120px]">Status</TableHead>
                  <TableHead className="text-right pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((teacher) => (
                  <TableRow key={teacher.id} className="group hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0">
                    <TableCell className="py-4 pl-6 align-middle">
                      <div className="space-y-1">
                        <div className="text-base text-foreground font-semibold tracking-tight">
                          {formatPersonName(teacher.name)}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground md:hidden">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[200px]">{teacher.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-4 align-middle">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-3.5 h-3.5 shrink-0 text-primary/70" />
                        <span>{teacher.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 align-middle">
                      {teacher.classes.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {teacher.classes.slice(0, 3).map((c) => (
                            <Badge
                              key={c.id}
                              variant="outline"
                              className="rounded-full font-medium capitalize border-primary/20 text-primary bg-primary/5"
                            >
                              {c.name}
                            </Badge>
                          ))}
                          {teacher.classes.length > 3 && (
                            <Badge variant="secondary" className="rounded-full font-medium">
                              +{teacher.classes.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 align-middle text-center">
                      <Badge
                        asChild
                        variant="secondary"
                        className={`inline-flex min-w-[88px] justify-center rounded-full shadow-none px-3 py-1 text-xs font-semibold transition ${
                          teacher.isActive
                            ? "bg-[#003D9E]/10 text-[#003D9E] hover:bg-[#003D9E]/15 border border-[#003D9E]/20"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                        } ${statusUpdating[teacher.id] ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleTeacherStatus(teacher)}
                          disabled={statusUpdating[teacher.id]}
                          title="Click to toggle status"
                        >
                          {teacher.isActive ? "Active" : "Inactive"}
                        </button>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-4 pr-6 align-middle">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(teacher)}
                          aria-label="Edit teacher"
                          className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(teacher.id)}
                          aria-label="Delete teacher"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} total
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1 || loading} onClick={() => void fetchTeachers(pagination.page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => void fetchTeachers(pagination.page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Teacher" : "Add Teacher"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update teacher profile and class assignments." : "Create a teacher account (role=TEACHER)."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teacherName">Name</Label>
              <Input id="teacherName" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherEmail">Email</Label>
              <Input id="teacherEmail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherPassword">{editing ? "New Password (optional)" : "Password"}</Label>
              <Input id="teacherPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={editing ? "Leave blank to keep current" : ""} />
            </div>

            <div className="space-y-2">
              <Label>Assign Classes</Label>
              <Card className="p-3 max-h-56 overflow-auto border-muted/60 bg-muted/10">
                <div className="space-y-1">
                  {classes.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                        selectedClassIds.includes(c.id) ? "bg-primary/8 border border-primary/15" : "hover:bg-muted/60"
                      }`}
                    >
                      <Checkbox checked={selectedClassIds.includes(c.id)} onCheckedChange={() => toggleClass(c.id)} />
                      <span className="flex-1 font-medium capitalize">{c.name}</span>
                      {!c.isActive && (
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </label>
                  ))}
                  {classes.length === 0 && <p className="text-sm text-muted-foreground px-2 py-4 text-center">No classes available.</p>}
                </div>
              </Card>
              <p className="text-xs text-muted-foreground">{selectedClassIds.length} class{selectedClassIds.length === 1 ? "" : "es"} selected</p>
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-lg border border-muted/60 bg-muted/10 p-4">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Deactivate to prevent login.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving...
                </>
              ) : editing ? (
                "Save Changes"
              ) : (
                "Create Teacher"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete teacher?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the teacher and unassign their classes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Spinner className="mr-2" />
                  Working...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
