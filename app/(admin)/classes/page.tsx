"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Pencil, Trash2, Clock, School } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { WEEKDAY_OPTIONS, formatScheduleDays } from "@/lib/class-schedule"

type Teacher = {
  id: string
  name: string
  email: string
}

type Shift = {
  id: string
  name: string
  startTime: string | null
  endTime: string | null
  isActive: boolean
}

type ClassRow = {
  id: string
  name: string
  level: string | null
  isActive: boolean
  teacherId?: string | null
  teacher?: Teacher | null
  shiftId?: string | null
  shift?: Shift | null
  studentsCount?: number
  scheduleDays?: number[]
}

const NO_TEACHER_VALUE = "__none__"
const NO_SHIFT_VALUE = "__none__"
const selectContentClass = "z-[200] bg-background border shadow-xl"

const SHIFT_PRESETS = [
  { name: "Morning", startTime: "08:00", endTime: "12:00", label: "Subax" },
  { name: "Afternoon", startTime: "13:00", endTime: "17:00", label: "Galab" },
  { name: "Evening", startTime: "17:00", endTime: "20:00", label: "Habeen" },
] as const

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function formatShiftLabel(shift: Shift) {
  if (shift.startTime && shift.endTime) return `${shift.name} (${shift.startTime} – ${shift.endTime})`
  return shift.name
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ClassRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [level, setLevel] = useState("")
  const [teacherId, setTeacherId] = useState<string>(NO_TEACHER_VALUE)
  const [shiftId, setShiftId] = useState<string>(NO_SHIFT_VALUE)
  const [scheduleDays, setScheduleDays] = useState<number[]>([])
  const [isActive, setIsActive] = useState(true)

  const [shiftsOpen, setShiftsOpen] = useState(false)
  const [shiftEditorOpen, setShiftEditorOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [shiftName, setShiftName] = useState("")
  const [shiftStartTime, setShiftStartTime] = useState("")
  const [shiftEndTime, setShiftEndTime] = useState("")
  const [shiftIsActive, setShiftIsActive] = useState(true)
  const [shiftSaving, setShiftSaving] = useState(false)
  const [shiftDeleteId, setShiftDeleteId] = useState<string | null>(null)
  const [shiftDeleting, setShiftDeleting] = useState(false)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({})

  const resetForm = () => {
    setName("")
    setLevel("")
    setTeacherId(NO_TEACHER_VALUE)
    setShiftId(NO_SHIFT_VALUE)
    setScheduleDays([])
    setIsActive(true)
    setEditing(null)
  }

  const resetShiftForm = () => {
    setShiftName("")
    setShiftStartTime("")
    setShiftEndTime("")
    setShiftIsActive(true)
    setEditingShift(null)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (cls: ClassRow) => {
    setEditing(cls)
    setName(cls.name ?? "")
    setLevel(cls.level ?? "")
    setTeacherId(cls.teacherId ?? NO_TEACHER_VALUE)
    setShiftId(cls.shiftId ?? NO_SHIFT_VALUE)
    setScheduleDays(cls.scheduleDays ?? [])
    setIsActive(Boolean(cls.isActive))
    setFormOpen(true)
  }

  const fetchClasses = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<ClassRow[]>("/api/classes")
      setClasses(res.data)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const fetchTeachers = async () => {
    try {
      const res = await api.get<Teacher[]>("/api/teachers")
      setTeachers(res.data)
    } catch (e: any) {
      toast({
        title: "Failed to load teachers",
        description: getErrorMessage(e),
        variant: "destructive",
      })
    }
  }

  const fetchShifts = async () => {
    try {
      const res = await api.get<Shift[]>("/api/shifts?includeInactive=true")
      setShifts(res.data)
    } catch (e: any) {
      toast({
        title: "Failed to load shifts",
        description: getErrorMessage(e),
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    void fetchTeachers()
    void fetchShifts()
    void fetchClasses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Class name is required", variant: "destructive" })
      return
    }

    if (!scheduleDays.length) {
      toast({ title: "Select class days", description: "Choose at least one day when this class meets.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        level: level.trim() ? level.trim() : null,
        teacherId: teacherId === NO_TEACHER_VALUE ? null : teacherId,
        shiftId: shiftId === NO_SHIFT_VALUE ? null : shiftId,
        scheduleDays,
        isActive,
      }

      if (editing) {
        await api.patch(`/api/classes/${editing.id}`, payload)
        toast({ title: "Class updated successfully" })
      } else {
        await api.post("/api/classes", payload)
        toast({ title: "Class created successfully" })
      }

      setFormOpen(false)
      resetForm()
      await fetchClasses()
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: getErrorMessage(e),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)

    const previous = classes
    setClasses((current) => current.filter((c) => c.id !== deleteId))

    try {
      await api.delete(`/api/classes/${deleteId}`)
      toast({ title: "Class deleted successfully" })
    } catch (e: any) {
      setClasses(previous)
      toast({
        title: "Delete failed",
        description: getErrorMessage(e),
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const toggleClassStatus = async (cls: ClassRow) => {
    if (statusUpdating[cls.id]) return
    const nextIsActive = !cls.isActive
    const prevIsActive = cls.isActive

    setStatusUpdating((cur) => ({ ...cur, [cls.id]: true }))
    setClasses((cur) => cur.map((c) => (c.id === cls.id ? { ...c, isActive: nextIsActive } : c)))

    try {
      await api.patch(`/api/classes/${cls.id}`, {
        name: cls.name,
        level: cls.level,
        teacherId: cls.teacherId,
        shiftId: cls.shiftId,
        scheduleDays: cls.scheduleDays ?? [],
        isActive: nextIsActive,
      })
      toast({ title: nextIsActive ? "Class is now ACTIVE" : "Class is now INACTIVE" })
    } catch (e: any) {
      setClasses((cur) => cur.map((c) => (c.id === cls.id ? { ...c, isActive: prevIsActive } : c)))
      toast({ title: "Update failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setStatusUpdating((cur) => {
        const next = { ...cur }
        delete next[cls.id]
        return next
      })
    }
  }

  const toggleScheduleDay = (day: number) => {
    setScheduleDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b),
    )
  }

  const rows = useMemo(() => classes, [classes])
  const activeShifts = useMemo(() => shifts.filter((s) => s.isActive), [shifts])

  const openCreateShift = () => {
    resetShiftForm()
    setShiftEditorOpen(true)
  }

  const openEditShift = (shift: Shift) => {
    setEditingShift(shift)
    setShiftName(shift.name)
    setShiftStartTime(shift.startTime ?? "")
    setShiftEndTime(shift.endTime ?? "")
    setShiftIsActive(Boolean(shift.isActive))
    setShiftEditorOpen(true)
  }

  const openPresetShift = (preset: (typeof SHIFT_PRESETS)[number]) => {
    setEditingShift(null)
    setShiftName(preset.name)
    setShiftStartTime(preset.startTime)
    setShiftEndTime(preset.endTime)
    setShiftIsActive(true)
    setShiftEditorOpen(true)
  }

  const quickAddPreset = async (preset: (typeof SHIFT_PRESETS)[number]) => {
    const exists = shifts.some(
      (s) => s.name.toLowerCase() === preset.name.toLowerCase() && s.isActive,
    )
    if (exists) {
      toast({ title: `${preset.name} shift already exists` })
      return
    }

    setShiftSaving(true)
    try {
      await api.post("/api/shifts", {
        name: preset.name,
        startTime: preset.startTime,
        endTime: preset.endTime,
        isActive: true,
      })
      toast({ title: `${preset.label} shift added` })
      await fetchShifts()
    } catch (e: any) {
      toast({ title: "Could not add shift", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setShiftSaving(false)
    }
  }

  const saveShift = async () => {
    if (!shiftName.trim()) {
      toast({ title: "Shift name is required", variant: "destructive" })
      return
    }

    setShiftSaving(true)
    try {
      const payload = {
        name: shiftName.trim(),
        startTime: shiftStartTime.trim() || null,
        endTime: shiftEndTime.trim() || null,
        isActive: shiftIsActive,
      }

      if (editingShift) {
        await api.patch(`/api/shifts/${editingShift.id}`, payload)
        toast({ title: "Shift updated successfully" })
      } else {
        await api.post("/api/shifts", payload)
        toast({ title: "Shift created successfully" })
      }

      setShiftEditorOpen(false)
      resetShiftForm()
      await fetchShifts()
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: getErrorMessage(e),
        variant: "destructive",
      })
    } finally {
      setShiftSaving(false)
    }
  }

  const confirmDeleteShift = async () => {
    if (!shiftDeleteId) return
    setShiftDeleting(true)
    try {
      await api.delete(`/api/shifts/${shiftDeleteId}`)
      toast({ title: "Shift deleted successfully" })
      if (shiftId === shiftDeleteId) setShiftId(NO_SHIFT_VALUE)
      await fetchShifts()
    } catch (e: any) {
      toast({
        title: "Delete failed",
        description: getErrorMessage(e),
        variant: "destructive",
      })
    } finally {
      setShiftDeleting(false)
      setShiftDeleteId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#003D9E]/10 via-background to-[#EC4724]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#003D9E]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/15 px-3 py-1 text-xs font-medium text-primary">
              <School className="w-3.5 h-3.5" />
              {rows.length} class{rows.length === 1 ? "" : "es"} · {activeShifts.length} shift{activeShifts.length === 1 ? "" : "s"}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Manage Classes</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Create classes, assign teachers, and set shifts in a few clicks.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShiftsOpen(true)}
              className="w-full sm:w-auto rounded-full gap-2 px-6 bg-background/80"
            >
              <Clock className="w-5 h-5" /> Shifts
            </Button>
            <Button onClick={openCreate} size="lg" className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6">
              <Plus className="w-5 h-5" /> Add Class
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-muted-foreground border border-dashed rounded-xl bg-card/50">
          <Spinner className="w-8 h-8 text-primary" />
          <span>Loading classes...</span>
        </div>
      ) : error ? (
        <div className="space-y-4 p-6 border border-destructive/20 bg-destructive/5 rounded-xl">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchClasses} className="border-destructive/30 hover:bg-destructive/10">
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-12 text-center flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-muted">
            <Plus className="w-8 h-8 opacity-50" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-medium text-foreground">No classes yet</p>
            <p className="text-muted-foreground text-sm">Create your first class to get started.</p>
          </div>
          <Button className="mt-2 rounded-full" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Class
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[200px]">Class Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell whitespace-nowrap">Level</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Shift</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Class Days</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Teacher</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell text-right whitespace-nowrap">Students</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-right pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((cls) => (
                  <TableRow key={cls.id} className="group hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0">
                    <TableCell className="py-4 pl-6 font-medium">
                      <div className="space-y-0.5">
                        <div className="text-base text-foreground font-semibold">{cls.name}</div>
                        <div className="text-xs text-muted-foreground md:hidden flex flex-wrap gap-2">
                          <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase font-medium tracking-wide">Level: {cls.level ?? "—"}</span>
                          <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase font-medium tracking-wide">Shift: {cls.shift?.name ?? "—"}</span>
                          <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase font-medium tracking-wide">Students: {cls.studentsCount ?? 0}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-4 text-muted-foreground">{cls.level ?? "—"}</TableCell>
                    <TableCell className="py-4 text-sm font-medium align-middle">
                      {cls.shift ? (
                        <Badge variant="outline" className="rounded-full font-medium border-[#EC4724]/25 text-[#EC4724] bg-[#EC4724]/5">
                          {formatShiftLabel(cls.shift)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground italic font-normal text-sm">No shift</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-sm font-medium align-middle">
                      <Badge variant="outline" className="rounded-full font-medium">
                        {formatScheduleDays(cls.scheduleDays ?? [])}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-sm font-medium align-middle">
                      {cls.teacher?.name ?? <span className="text-muted-foreground italic font-normal">Unassigned</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right py-4 tabular-nums">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted/50 border border-muted">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                        {cls.studentsCount ?? 0}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 align-middle text-center">
                      <Badge
                        asChild
                        variant="secondary"
                        className={`inline-flex min-w-[88px] justify-center rounded-full shadow-none px-3 py-1 text-xs font-semibold transition ${
                          cls.isActive
                            ? "bg-[#003D9E]/10 text-[#003D9E] hover:bg-[#003D9E]/15 border border-[#003D9E]/20"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                        } ${statusUpdating[cls.id] ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleClassStatus(cls)}
                          disabled={statusUpdating[cls.id]}
                        >
                          {cls.isActive ? "Active" : "Inactive"}
                        </button>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-4 pr-6">
                      <div className="flex justify-end gap-2 opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(cls)}
                          aria-label="Edit class"
                          className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(cls.id)}
                          aria-label="Delete class"
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
            <DialogTitle>{editing ? "Edit Class" : "Add Class"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update class details and assignment." : "Create a new class and optionally assign a teacher."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="className">Class Name</Label>
              <Input
                id="className"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Class A"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="classLevel">Level</Label>
              <Input
                id="classLevel"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="e.g. Level 1 (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={shiftId} onValueChange={setShiftId}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select a shift" />
                </SelectTrigger>
                <SelectContent className={selectContentClass} position="popper">
                  <SelectItem value={NO_SHIFT_VALUE}>No shift</SelectItem>
                  {activeShifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {formatShiftLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeShifts.length === 0 ? (
                <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setShiftsOpen(true)}>
                  No shifts yet — tap here to add one
                </Button>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Class Days</Label>
              <p className="text-xs text-muted-foreground">Select the days this cohort meets (e.g. Mon + Wed).</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => {
                  const active = scheduleDays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleScheduleDay(day.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted bg-background hover:bg-muted/50"
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent className={selectContentClass} position="popper">
                  <SelectItem value={NO_TEACHER_VALUE}>Unassigned</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {teacherId !== NO_TEACHER_VALUE && (
                <p className="text-xs text-muted-foreground">
                  {teachers.find((t) => t.id === teacherId)?.email}
                </p>
              )}
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-xs text-muted-foreground">Activate or deactivate this class.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{isActive ? "Active" : "Inactive"}</span>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
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
                  Saving…
                </>
              ) : editing ? (
                "Save Changes"
              ) : (
                "Create Class"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={shiftsOpen}
        onOpenChange={(open) => {
          setShiftsOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Shifts</DialogTitle>
            <DialogDescription>Quick setup — tap a preset or create your own.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick add</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SHIFT_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    type="button"
                    variant="outline"
                    className="h-auto flex-col items-start gap-1 rounded-xl px-3 py-3 text-left"
                    disabled={shiftSaving}
                    onClick={() => void quickAddPreset(preset)}
                  >
                    <span className="font-semibold text-sm">{preset.label}</span>
                    <span className="text-xs text-muted-foreground">{preset.startTime} – {preset.endTime}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your shifts</p>
              <Button type="button" size="sm" className="rounded-full gap-1.5" onClick={openCreateShift}>
                <Plus className="w-4 h-4" /> Custom
              </Button>
            </div>

            {shifts.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Tap Subax, Galab, or Habeen above to start.
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {shifts.map((shift) => (
                  <Card key={shift.id} className="p-3 border-muted/60 shadow-none">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{shift.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {shift.startTime && shift.endTime ? `${shift.startTime} – ${shift.endTime}` : "No time set"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="secondary" className={shift.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                          {shift.isActive ? "Active" : "Off"}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditShift(shift)} aria-label="Edit shift">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setShiftDeleteId(shift.id)} aria-label="Delete shift">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={shiftEditorOpen}
        onOpenChange={(open) => {
          setShiftEditorOpen(open)
          if (!open) resetShiftForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingShift ? "Edit Shift" : "New Shift"}</DialogTitle>
            <DialogDescription>Name and time — keep it simple.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shiftName">Name</Label>
              <Input
                id="shiftName"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                placeholder="e.g. Morning"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="shiftStart">Start</Label>
                <Input id="shiftStart" type="time" value={shiftStartTime} onChange={(e) => setShiftStartTime(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shiftEnd">End</Label>
                <Input id="shiftEnd" type="time" value={shiftEndTime} onChange={(e) => setShiftEndTime(e.target.value)} className="bg-background" />
              </div>
            </div>
            {!editingShift && (
              <div className="flex flex-wrap gap-2">
                {SHIFT_PRESETS.map((preset) => (
                  <Button key={preset.name} type="button" variant="secondary" size="sm" className="rounded-full" onClick={() => openPresetShift(preset)}>
                    {preset.label}
                  </Button>
                ))}
              </div>
            )}
            {editingShift && (
              <div className="flex items-center justify-between rounded-lg border border-muted/60 bg-muted/10 p-3">
                <span className="text-sm font-medium">Active</span>
                <Switch checked={shiftIsActive} onCheckedChange={setShiftIsActive} />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setShiftEditorOpen(false)} disabled={shiftSaving}>
              Cancel
            </Button>
            <Button onClick={saveShift} disabled={shiftSaving} className="rounded-full px-6">
              {shiftSaving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving…
                </>
              ) : editingShift ? (
                "Save"
              ) : (
                "Add Shift"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(shiftDeleteId)} onOpenChange={(open) => !open && setShiftDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete shift?</AlertDialogTitle>
            <AlertDialogDescription>
              Shifts assigned to classes cannot be deleted. Remove the shift from all classes first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={shiftDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteShift} disabled={shiftDeleting}>
              {shiftDeleting ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete class?</AlertDialogTitle>
            <AlertDialogDescription>This action can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting…
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
