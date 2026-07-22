"use client"

import { useEffect, useMemo, useState } from "react"
import { MessageSquare, Mail, Send, Users, BookOpen, User, RefreshCw, AlertTriangle, Smartphone } from "lucide-react"

import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"

type ClassOption = { id: string; name: string; level: string | null; isActive: boolean }
type CourseOption = { id: string; name: string; classId: string | null; status: string }
type EmailLogRow = {
  id: string
  to: string | null
  subject: string | null
  status: string | null
  error: string | null
  createdAt: string | null
}

type TargetType = "CLASS" | "COURSE" | "SINGLE"
type MessageMode = "EMAIL" | "WHATSAPP" | "SMS"

type StudentOption = {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  class?: { name: string } | null
}

const selectContentClass = "z-[200] bg-background border shadow-xl"

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function studentHasContact(student: StudentOption, mode: MessageMode) {
  if (mode === "EMAIL") return Boolean(student.email)
  return Boolean(student.phone)
}

function modeLabel(mode: MessageMode) {
  if (mode === "WHATSAPP") return "WhatsApp"
  if (mode === "SMS") return "SMS (Hormuud)"
  return "Email"
}
function formatPersonName(firstName: string, lastName: string) {
  const format = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  return `${format(firstName)} ${format(lastName)}`.trim()
}

export default function MessagesCenter() {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [reloading, setReloading] = useState(false)

  const [mode, setMode] = useState<MessageMode>("WHATSAPP")
  const [targetType, setTargetType] = useState<TargetType>("CLASS")
  const [classId, setClassId] = useState<string>("")
  const [courseId, setCourseId] = useState<string>("")
  const [studentId, setStudentId] = useState<string>("")

  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [failures, setFailures] = useState<EmailLogRow[]>([])
  const [loadingFailures, setLoadingFailures] = useState(false)

  const load = async (loadMode: "initial" | "refresh") => {
    if (loadMode === "initial") setLoading(true)
    if (loadMode === "refresh") setReloading(true)
    try {
      const [classesRes, coursesRes, studentsRes] = await Promise.all([
        api.get<ClassOption[]>("/api/classes"),
        api.get<any[]>("/api/courses"),
        api.get<{ items: StudentOption[] }>("/api/students?page=1&pageSize=100&isActive=true"),
      ])

      const nextClasses = classesRes.data
      const nextCourses = (Array.isArray(coursesRes.data) ? coursesRes.data : []).map((c) => ({
        id: c.id,
        name: c.name,
        classId: c.classId ?? null,
        status: c.status ?? "ACTIVE",
      }))

      setClasses(nextClasses)
      setCourses(nextCourses)
      setStudents(studentsRes.data.items ?? [])

      if (nextClasses.length) setClassId((cur) => cur || nextClasses[0].id)
      if (nextCourses.length) setCourseId((cur) => cur || nextCourses[0].id)
      const studentItems = studentsRes.data.items ?? []
      if (studentItems.length) setStudentId((cur) => cur || studentItems[0].id)
    } catch (e: any) {
      toast({ title: "Failed to load data", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
      setReloading(false)
    }
  }

  useEffect(() => {
    void load("initial")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recipientSummary = useMemo(() => {
    if (targetType === "COURSE") {
      const course = courses.find((c) => c.id === courseId)
      return course ? `All students in course "${course.name}"` : "Select a course"
    }
    if (targetType === "SINGLE") {
      const student = students.find((s) => s.id === studentId)
      if (!student) return "Select a student"
      const contact = mode === "EMAIL" ? student.email : student.phone
      return `${formatPersonName(student.firstName, student.lastName)}${contact ? ` · ${contact}` : mode === "EMAIL" ? " · no email" : " · no phone"}`
    }
    const cls = classes.find((c) => c.id === classId)
    return cls ? `All students in class "${cls.name}"` : "Select a class"
  }, [targetType, classId, courseId, studentId, classes, courses, students, mode])

  const send = async () => {
    if (mode === "EMAIL" && !subject.trim()) {
      toast({ title: "Add a subject", description: "Email messages need a subject line.", variant: "destructive" })
      return
    }
    if (!message.trim()) {
      toast({ title: "Write your message", description: "The message body cannot be empty.", variant: "destructive" })
      return
    }

    setSending(true)
    try {
      if (targetType === "SINGLE") {
        const endpoint =
          mode === "EMAIL"
            ? "/api/notifications/email/single"
            : mode === "SMS"
              ? "/api/notifications/sms/single"
              : "/api/notifications/whatsapp/single"
        const payload =
          mode === "EMAIL"
            ? { studentId, subject: subject.trim(), message: message.trim() }
            : { studentId, message: message.trim() }

        await api.post(endpoint, payload)
        toast({
          title: "Message sent",
          description: `${modeLabel(mode)} delivered to the student.`,
        })
      } else {
        const endpoint =
          mode === "EMAIL"
            ? "/api/notifications/email/broadcast"
            : mode === "SMS"
              ? "/api/notifications/sms/broadcast"
              : "/api/notifications/whatsapp/broadcast"

        const payload =
          targetType === "COURSE"
            ? mode === "EMAIL"
              ? { courseId, subject: subject.trim(), message: message.trim() }
              : { courseId, message: message.trim() }
            : mode === "EMAIL"
              ? { classId, subject: subject.trim(), message: message.trim() }
              : { classId, message: message.trim() }

        const res = await api.post<{ sent: number; skipped: number; failed: number; total: number }>(endpoint, payload)
        toast({
          title: "Broadcast complete",
          description: `Sent: ${res.data.sent} · Skipped: ${res.data.skipped} · Failed: ${res.data.failed}`,
        })
      }
      setSubject("")
      setMessage("")
      setFailures([])
    } catch (e: any) {
      toast({ title: "Send failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const loadFailures = async () => {
    setLoadingFailures(true)
    try {
      const res = await api.get<EmailLogRow[]>("/api/notifications/email/logs?status=FAILED&limit=20")
      setFailures(res.data)
      if (!res.data.length) toast({ title: "All good", description: "No failed emails in the last 20 attempts." })
    } catch (e: any) {
      toast({ title: "Failed to load logs", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setLoadingFailures(false)
    }
  }

  const targetOptions = [
    { value: "CLASS" as const, label: "Whole Class", icon: Users, desc: "Send to everyone in a class" },
    { value: "COURSE" as const, label: "Course", icon: BookOpen, desc: "Send to a course group" },
    { value: "SINGLE" as const, label: "One Student", icon: User, desc: "Send to one person only" },
  ]

  const studentsWithContact = useMemo(() => {
    return students.filter((s) => studentHasContact(s, mode)).length
  }, [students, mode])

  const channelOptions = [
    {
      value: "WHATSAPP" as const,
      label: "WhatsApp",
      desc: "Send to students who have a phone number saved.",
      icon: MessageSquare,
      activeBorder: "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20",
      iconActive: "bg-emerald-500 text-white",
    },
    {
      value: "SMS" as const,
      label: "SMS Hormuud",
      desc: "Send text messages through the Hormuud SMS gateway.",
      icon: Smartphone,
      activeBorder: "border-orange-500 bg-orange-50/60 ring-2 ring-orange-500/20",
      iconActive: "bg-orange-500 text-white",
    },
    {
      value: "EMAIL" as const,
      label: "Email",
      desc: "Send to students who have an email address saved.",
      icon: Mail,
      activeBorder: "border-[#2060AC] bg-[#2060AC]/5 ring-2 ring-[#2060AC]/20",
      iconActive: "bg-[#2060AC] text-white",
    },
  ]

  const activeChannelDesc = channelOptions.find((o) => o.value === mode)?.desc ?? ""
  const activeTargetDesc = targetOptions.find((o) => o.value === targetType)?.desc ?? ""

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1280px] grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] md:gap-6 lg:gap-8 md:items-start">
        {/* Left: form column */}
        <div className="space-y-5 min-w-0">
          <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#2060AC]/10 via-background to-[#FCBE1A]/5 p-5 sm:p-6">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#2060AC]/10 blur-3xl" />
            <div className="relative space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full bg-background/80 border-primary/20 text-primary font-medium">
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                  Messaging
                </Badge>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Send a Message</h1>
              <p className="text-sm text-muted-foreground">
                WhatsApp, SMS Hormuud, or Email — pick a channel, choose recipients, and send.
              </p>
            </div>
          </div>

      {loading ? (
        <Card className="p-12 border-dashed flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading...</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Step 1: Channel */}
          <Card className="border-muted/50 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b bg-muted/20">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Step 1</p>
              <h2 className="text-lg font-semibold">How do you want to send?</h2>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {channelOptions.map((opt) => {
                  const Icon = opt.icon
                  const active = mode === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={`flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 px-2 py-4 sm:py-5 transition-all text-center ${
                        active ? `${opt.activeBorder} shadow-sm` : "border-muted hover:border-muted-foreground/25 hover:bg-muted/30"
                      }`}
                    >
                      <div className={`p-2.5 sm:p-3 rounded-xl ${active ? opt.iconActive : "bg-muted text-muted-foreground"}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="font-semibold text-xs sm:text-sm leading-tight text-foreground">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-sm text-muted-foreground text-center leading-relaxed px-1">{activeChannelDesc}</p>
            </div>
          </Card>

          {/* Step 2: Recipients */}
          <Card className="border-muted/50 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b bg-muted/20 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Step 2</p>
                <h2 className="text-lg font-semibold">Who receives this?</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void load("refresh")} disabled={reloading} className="rounded-full h-8">
                {reloading ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
            <div className="p-4 sm:p-5 space-y-5">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {targetOptions.map((opt) => {
                    const Icon = opt.icon
                    const active = targetType === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTargetType(opt.value)}
                        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 px-2 py-4 transition-all text-center ${
                          active
                            ? "border-primary bg-primary/5 ring-2 ring-primary/15 shadow-sm"
                            : "border-muted hover:border-muted-foreground/25 hover:bg-muted/30"
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="font-medium text-xs sm:text-sm leading-tight">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-sm text-muted-foreground text-center leading-relaxed">{activeTargetDesc}</p>
              </div>

              {targetType === "CLASS" && (
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger className="w-full h-11 bg-background">
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass} position="popper">
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!classes.length && <p className="text-sm text-muted-foreground">Create a class first.</p>}
                </div>
              )}

              {targetType === "COURSE" && (
                <div className="space-y-2">
                  <Label>Course</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger className="w-full h-11 bg-background">
                      <SelectValue placeholder="Choose a course" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass} position="popper">
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!courses.length && <p className="text-sm text-muted-foreground">No courses found.</p>}
                </div>
              )}

              {targetType === "SINGLE" && (
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger className="w-full h-11 bg-background">
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass} position="popper">
                      {students.map((s) => {
                        const hasContact = studentHasContact(s, mode)
                        return (
                          <SelectItem key={s.id} value={s.id} disabled={!hasContact}>
                            {formatPersonName(s.firstName, s.lastName)}
                            {s.class ? ` · ${s.class.name}` : ""}
                            {!hasContact && (mode === "EMAIL" ? " (no email)" : " (no phone)")}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="rounded-xl bg-muted/40 border border-muted px-4 py-3 text-sm md:hidden">
                <span className="text-muted-foreground">Sending to: </span>
                <span className="font-medium text-foreground">{recipientSummary}</span>
              </div>
            </div>
          </Card>

          {/* Step 3: Compose */}
          <Card className="border-muted/50 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b bg-muted/20">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Step 3</p>
              <h2 className="text-lg font-semibold">Write your message</h2>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              {mode === "EMAIL" && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Exam schedule update"
                    className="h-11 bg-background"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="message">Message</Label>
                  <span className="text-xs text-muted-foreground">Tip: type [[name]] to use the student&apos;s name</span>
                </div>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    mode === "EMAIL"
                      ? "Dear [[name]],\n\nPlease note that..."
                      : "Hello [[name]], this is a reminder about tomorrow's class..."
                  }
                  rows={6}
                  className="min-h-[160px] resize-y bg-background text-base leading-relaxed p-4"
                />
                <p className="text-xs text-muted-foreground">{message.length} characters</p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-dashed">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadFailures}
                  disabled={sending || loadingFailures || mode !== "EMAIL"}
                  className="text-muted-foreground rounded-full"
                >
                  {loadingFailures ? (
                    <>
                      <Spinner className="mr-2 w-4 h-4" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="mr-2 w-4 h-4" />
                      View failed emails
                    </>
                  )}
                </Button>
                <Button
                  onClick={send}
                  disabled={sending || !message.trim() || (mode === "EMAIL" && !subject.trim())}
                  size="lg"
                  className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 gap-2 px-8"
                >
                  {sending ? (
                    <>
                      <Spinner className="w-4 h-4" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send {modeLabel(mode)}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {failures.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-destructive/10 flex items-center justify-between">
            <p className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Failed email deliveries
            </p>
            <span className="text-xs text-muted-foreground">Last 20 attempts</span>
          </div>
          <div className="divide-y divide-destructive/10">
            {failures.map((f) => (
              <div key={f.id} className="px-5 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="font-medium text-foreground">{f.to ?? "—"}</span>
                <span className="text-muted-foreground truncate flex-1">{f.subject ?? "—"}</span>
                <span className="text-destructive text-xs font-medium">{f.error ?? "Unknown error"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
        </div>

        {/* Right: summary panel — fills the empty space */}
        <aside className="hidden md:block space-y-4 md:sticky md:top-6">
          <Card className="border-muted/50 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/20">
              <h2 className="text-sm font-semibold text-foreground">Overview</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/40 border border-muted px-4 py-3">
                  <p className="text-2xl font-bold text-foreground">{classes.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Classes</p>
                </div>
                <div className="rounded-xl bg-muted/40 border border-muted px-4 py-3">
                  <p className="text-2xl font-bold text-foreground">{students.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Students</p>
                </div>
              </div>
              <div className="rounded-xl bg-muted/40 border border-muted px-4 py-3">
                <p className="text-2xl font-bold text-foreground">{studentsWithContact}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reachable via {modeLabel(mode)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-muted/50 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/20">
              <h2 className="text-sm font-semibold text-foreground">Current selection</h2>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Channel</span>
                <Badge variant="outline" className="rounded-full font-medium">
                  {modeLabel(mode)}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Target</span>
                <span className="font-medium text-foreground">
                  {targetType === "CLASS" ? "Whole Class" : targetType === "COURSE" ? "Course" : "One Student"}
                </span>
              </div>
              <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Sending to</p>
                <p className="font-medium text-foreground leading-snug">{recipientSummary}</p>
              </div>
              {message.trim() && (
                <div className="rounded-xl bg-muted/40 border border-muted px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Message preview</p>
                  <p className="text-foreground whitespace-pre-wrap line-clamp-4 text-xs leading-relaxed">{message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{message.length} characters</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="border-muted/50 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/20">
              <h2 className="text-sm font-semibold text-foreground">Tips</h2>
            </div>
            <ul className="p-5 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary font-bold shrink-0">·</span>
                Type <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">[[name]]</code> to insert each student&apos;s name.
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold shrink-0">·</span>
                {mode === "EMAIL"
                  ? "Students without an email address are skipped automatically."
                  : "Students without a phone number are skipped automatically."}
              </li>
              {mode === "SMS" && (
                <li className="flex gap-2">
                  <span className="text-primary font-bold shrink-0">·</span>
                  Hormuud SMS requires account balance. Phone format: 61xxxxxxx.
                </li>
              )}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  )
}
