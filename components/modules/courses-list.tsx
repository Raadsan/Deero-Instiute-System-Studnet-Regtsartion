"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Pencil, Trash2, Search, BookOpen } from "lucide-react"

import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type CourseStatus = "ACTIVE" | "SCHEDULED" | "INACTIVE"

type TeacherOption = {
  id: string
  name: string
  email: string
  isActive?: boolean
}

type ClassOption = {
  id: string
  name: string
  level: string | null
  isActive: boolean
}

type CourseRow = {
  id: string
  name: string
  classId: string | null
  class: { id: string; name: string; level: string | null; isActive: boolean } | null
  teacherId: string | null
  teacher: { id: string; name: string; email: string } | null
  status: CourseStatus
  studentsCount: number
}

const NO_TEACHER_VALUE = "__none__"
const selectContentClass = "z-[200] bg-background border shadow-xl"

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function statusLabel(status: CourseStatus) {
  switch (status) {
    case "ACTIVE":
      return "Active"
    case "SCHEDULED":
      return "Scheduled"
    case "INACTIVE":
      return "Inactive"
  }
}

export default function CoursesList() {
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CourseRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [classId, setClassId] = useState<string>("")
  const [teacherId, setTeacherId] = useState<string>(NO_TEACHER_VALUE)
  const [status, setStatus] = useState<CourseStatus>("ACTIVE")
  const [sendEmail, setSendEmail] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailMessage, setEmailMessage] = useState("")

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const resetForm = () => {
    setEditing(null)
    setName("")
    setClassId("")
    setTeacherId(NO_TEACHER_VALUE)
    setStatus("ACTIVE")
    setSendEmail(false)
    setEmailSubject("")
    setEmailMessage("")
  }

  const openCreate = () => {
    resetForm()
    if (classes.length) setClassId(classes[0].id)
    setFormOpen(true)
  }

  const openEdit = (course: CourseRow) => {
    setEditing(course)
    setName(course.name ?? "")
    setClassId(course.classId ?? "")
    setTeacherId(course.teacherId ?? NO_TEACHER_VALUE)
    setStatus(course.status ?? "ACTIVE")
    setFormOpen(true)
  }

  const fetchCourses = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<CourseRow[]>("/api/courses")
      setCourses(res.data)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const fetchClasses = async () => {
    try {
      const res = await api.get<ClassOption[]>("/api/classes")
      setClasses(res.data)
    } catch (e: any) {
      toast({ title: "Failed to load classes", description: getErrorMessage(e), variant: "destructive" })
    }
  }

  const fetchTeachers = async () => {
    try {
      const res = await api.get<TeacherOption[]>("/api/teachers?includeInactive=true")
      setTeachers(res.data)
    } catch (e: any) {
      toast({ title: "Failed to load teachers", description: getErrorMessage(e), variant: "destructive" })
    }
  }

  useEffect(() => {
    void fetchClasses()
    void fetchTeachers()
    void fetchCourses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredCourses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return courses
    return courses.filter((c) => {
      const teacherName = c.teacher?.name ?? ""
      const className = c.class?.name ?? ""
      return c.name.toLowerCase().includes(q) || teacherName.toLowerCase().includes(q) || className.toLowerCase().includes(q)
    })
  }, [courses, searchTerm])

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Course name is required", variant: "destructive" })
      return
    }
    if (!classId) {
      toast({ title: "Select a class", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        classId,
        teacherId: teacherId === NO_TEACHER_VALUE ? null : teacherId,
        status,
      }

      if (editing) {
        await api.patch(`/api/courses/${editing.id}`, payload)
        toast({ title: "Course updated" })
      } else {
        const created = await api.post<{ id: string; classId: string }>("/api/courses", payload)
        toast({ title: "Course created" })

        if (sendEmail && emailSubject.trim() && emailMessage.trim()) {
          await api.post("/api/notifications/email/broadcast", {
            courseId: created.data.id,
            subject: emailSubject.trim(),
            message: emailMessage.trim(),
          })
          toast({ title: "Email sent", description: "Announcement sent to students in this course/class." })
        }
      }

      setFormOpen(false)
      resetForm()
      await fetchCourses()
    } catch (e: any) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const prev = courses
    setCourses((cur) => cur.filter((c) => c.id !== deleteId))
    try {
      await api.delete(`/api/courses/${deleteId}`)
      toast({ title: "Course deleted" })
    } catch (e: any) {
      setCourses(prev)
      toast({ title: "Delete failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#2060AC]/10 via-background to-[#FCBE1A]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#2060AC]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/15 px-3 py-1 text-xs font-medium text-primary">
              <BookOpen className="w-3.5 h-3.5" />
              {filteredCourses.length} course{filteredCourses.length === 1 ? "" : "s"}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Courses</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Add subjects (courses) and link them to a class. Simple: name + class + teacher.
            </p>
          </div>
          <Button onClick={openCreate} size="lg" className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6 shrink-0">
            <Plus className="w-5 h-5" /> Add Course
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-5 border-muted/50 shadow-sm">
        <div className="max-w-xl space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Search</Label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Course, class, or teacher..."
              className="pl-10 h-11 rounded-lg bg-background border-muted shadow-sm focus-visible:ring-primary/20"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading courses...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm bg-destructive/5 text-destructive border-destructive/20 shadow-sm">{error}</Card>
      ) : filteredCourses.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <div className="p-4 rounded-full bg-muted">
            <Search className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-lg font-medium">No courses found</p>
          <p className="text-sm">Try adjusting your search query.</p>
        </Card>
      ) : (
        <div className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[200px]">Course Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell whitespace-nowrap">Class</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell whitespace-nowrap">Teacher</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell whitespace-nowrap">Students</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-right pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCourses.map((course) => (
                  <TableRow key={course.id} className="group hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0">
                    <TableCell className="py-4 pl-6 font-medium">
                      <div className="space-y-0.5">
                        <div className="text-base text-foreground font-semibold">{course.name}</div>
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground md:hidden">
                          <span><span className="font-medium text-foreground/70">Class:</span> {course.class?.name ?? "—"}</span>
                          <span><span className="font-medium text-foreground/70">Teacher:</span> {course.teacher?.name ?? "Unassigned"}</span>
                          <span className="lg:hidden"><span className="font-medium text-foreground/70">Students:</span> {course.studentsCount}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-4 align-middle">
                      <Badge variant="outline" className="rounded-full font-medium capitalize border-primary/20 text-primary bg-primary/5">
                        {course.class?.name ?? "Unassigned"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-4 text-sm text-foreground/80 align-middle">
                      {course.teacher?.name ?? <span className="text-muted-foreground italic">Unassigned</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell py-4 align-middle">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 border border-muted px-2.5 py-0.5 text-sm font-medium tabular-nums">
                        {course.studentsCount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 align-middle text-center">
                      <Badge
                        variant="secondary"
                        className={`inline-flex min-w-[88px] justify-center rounded-full shadow-none px-3 py-1 text-xs font-semibold ${
                          course.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : course.status === "SCHEDULED"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {statusLabel(course.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-4 pr-6 align-middle">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(course)}
                          aria-label="Edit course"
                          className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(course.id)}
                          aria-label="Delete course"
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
            <DialogTitle>{editing ? "Edit Course" : "Add Course"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update course details and assignment." : "Create a new course and assign a class and teacher."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="courseName">Course name</Label>
              <Input id="courseName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics" className="bg-background" />
            </div>

            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent className={selectContentClass} position="popper">
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!classes.length && <p className="text-xs text-muted-foreground">Create a class first in the Classes page.</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teacher <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select value={teacherId} onValueChange={setTeacherId}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Unassigned" />
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
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as CourseStatus)}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Active" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass} position="popper">
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editing && (
              <div className="rounded-lg border border-dashed border-muted/60 bg-muted/10 p-3 space-y-3">
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(Boolean(v))} />
                  <span>Email students (optional)</span>
                </label>
                {sendEmail && (
                  <div className="space-y-2 pt-1">
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Email subject"
                      className="bg-background"
                    />
                    <Textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Short message to students..."
                      rows={3}
                      className="bg-background resize-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || !classes.length} className="rounded-full px-6">
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving...
                </>
              ) : editing ? (
                "Save Changes"
              ) : (
                "Create Course"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course?</AlertDialogTitle>
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
    </div>
  )
}
