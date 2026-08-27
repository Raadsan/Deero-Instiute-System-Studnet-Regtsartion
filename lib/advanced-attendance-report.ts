import { prisma } from "@/lib/prisma"

export const DEFAULT_LOW_ATTENDANCE_THRESHOLD = 75

type AttendanceRow = {
  id: string
  date: Date
  status: string
  studentId: string
  classId: string
  teacherId: string | null
}

type AttendanceCounter = {
  present: number
  late: number
  absent: number
  excused: number
  leave: number
}

export type AttendanceMetrics = AttendanceCounter & {
  attended: number
  eligiblePeriods: number
  records: number
  attendanceRate: number | null
}

export type AdvancedAttendanceReport = {
  range: {
    month: string
    label: string
    from: string
    to: string
  }
  threshold: number
  summary: AttendanceMetrics & {
    teachingPeriods: number
    teachersReporting: number
    classesReporting: number
    studentsEvaluated: number
    lowAttendanceStudents: number
  }
  teacherPerformance: Array<AttendanceMetrics & {
    teacherId: string
    teacherName: string
    teacherEmail: string
    isActive: boolean
    classes: string[]
    teachingPeriods: number
    performance: "EXCELLENT" | "GOOD" | "NEEDS_ATTENTION" | "NO_DATA"
  }>
  classComparison: Array<AttendanceMetrics & {
    classId: string
    className: string
    teacherName: string | null
    studentCount: number
    teachingPeriods: number
  }>
  lowAttendanceStudents: Array<AttendanceMetrics & {
    studentId: string
    studentCode: string | null
    studentName: string
    phone: string | null
    className: string | null
  }>
}

function resolveMonth(value?: string | null) {
  const now = new Date()
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const month = value?.trim() || fallback
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!match) throw new Error("Month must use YYYY-MM format")

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const from = new Date(year, monthIndex, 1, 0, 0, 0, 0)
  const nextMonth = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0)
  const to = new Date(nextMonth.getTime() - 1)

  return {
    month,
    from,
    to,
    label: from.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  }
}

function resolveThreshold(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return DEFAULT_LOW_ATTENDANCE_THRESHOLD
  const threshold = Number(value)
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 100) {
    throw new Error("Attendance threshold must be between 1 and 100")
  }
  return Math.round(threshold * 100) / 100
}

function emptyCounter(): AttendanceCounter {
  return { present: 0, late: 0, absent: 0, excused: 0, leave: 0 }
}

function countStatus(counter: AttendanceCounter, status: string) {
  if (status === "PRESENT") counter.present++
  else if (status === "LATE") counter.late++
  else if (status === "ABSENT") counter.absent++
  else if (status === "EXCUSED") counter.excused++
  else if (status === "LEAVE") counter.leave++
}

function finalizeCounter(counter: AttendanceCounter): AttendanceMetrics {
  const attended = counter.present + counter.late
  const eligiblePeriods = attended + counter.absent
  const records = eligiblePeriods + counter.excused + counter.leave
  const attendanceRate = eligiblePeriods
    ? Math.round((attended / eligiblePeriods) * 10_000) / 100
    : null

  return { ...counter, attended, eligiblePeriods, records, attendanceRate }
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getPerformance(rate: number | null) {
  if (rate === null) return "NO_DATA" as const
  if (rate >= 90) return "EXCELLENT" as const
  if (rate >= 75) return "GOOD" as const
  return "NEEDS_ATTENTION" as const
}

export async function getAdvancedAttendanceReport(input: {
  month?: string | null
  threshold?: number | string | null
}): Promise<AdvancedAttendanceReport> {
  const range = resolveMonth(input.month)
  const threshold = resolveThreshold(input.threshold)
  const dateFilter = { gte: range.from, lte: range.to }

  const [currentRows, archivedRows, teacherDocs, classDocs, studentDocs] = await Promise.all([
    prisma.attendance.findMany({
      where: { date: dateFilter },
      select: {
        id: true,
        date: true,
        status: true,
        studentId: true,
        classId: true,
        teacherId: true,
      },
    }),
    prisma.attendanceArchive.findMany({
      where: { date: dateFilter },
      select: {
        originalId: true,
        date: true,
        status: true,
        studentId: true,
        classId: true,
        teacherId: true,
      },
    }),
    prisma.user.findMany({
      where: { role: "TEACHER" },
      select: { id: true, name: true, email: true, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        teacherId: true,
        teacher: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: { isActive: true, isHidden: false, enrollmentStatus: "ENROLLED" },
      select: {
        id: true,
        studentCode: true,
        firstName: true,
        lastName: true,
        phone: true,
        classId: true,
        class: { select: { name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ])

  const currentIds = new Set(currentRows.map((row) => row.id))
  const rows: AttendanceRow[] = [
    ...currentRows.map((row) => ({ ...row, status: String(row.status) })),
    ...archivedRows
      .filter((row) => !currentIds.has(row.originalId))
      .map((row) => ({
        id: row.originalId,
        date: row.date,
        status: String(row.status),
        studentId: row.studentId,
        classId: row.classId,
        teacherId: row.teacherId,
      })),
  ]

  const classMap = new Map(classDocs.map((item) => [item.id, item]))
  const teacherMap = new Map(teacherDocs.map((item) => [item.id, item]))
  const knownTeacherIds = new Set(teacherDocs.map((item) => item.id))
  const studentMap = new Map(studentDocs.map((item) => [item.id, item]))

  const classStudentCounts = new Map<string, number>()
  for (const student of studentDocs) {
    if (!student.classId) continue
    classStudentCounts.set(student.classId, (classStudentCounts.get(student.classId) ?? 0) + 1)
  }

  const classStats = new Map<string, { counter: AttendanceCounter; periods: Set<string> }>()
  for (const item of classDocs) {
    if (item.isActive) classStats.set(item.id, { counter: emptyCounter(), periods: new Set() })
  }

  const teacherStats = new Map<
    string,
    { counter: AttendanceCounter; periods: Set<string>; classNames: Set<string> }
  >()
  for (const teacher of teacherDocs) {
    if (!teacher.isActive) continue
    const assignedClasses = classDocs
      .filter((item) => item.isActive && item.teacherId === teacher.id)
      .map((item) => item.name)
    teacherStats.set(teacher.id, {
      counter: emptyCounter(),
      periods: new Set(),
      classNames: new Set(assignedClasses),
    })
  }

  const studentStats = new Map<string, AttendanceCounter>()
  const overallCounter = emptyCounter()
  const overallPeriods = new Set<string>()

  for (const row of rows) {
    countStatus(overallCounter, row.status)
    overallPeriods.add(`${row.classId}:${dayKey(row.date)}`)

    const classItem = classMap.get(row.classId)
    const classBucket = classStats.get(row.classId) ?? { counter: emptyCounter(), periods: new Set<string>() }
    countStatus(classBucket.counter, row.status)
    classBucket.periods.add(dayKey(row.date))
    classStats.set(row.classId, classBucket)

    const assignedTeacherId = classItem?.teacherId
    const effectiveTeacherId = assignedTeacherId ?? (row.teacherId && knownTeacherIds.has(row.teacherId) ? row.teacherId : null)
    if (effectiveTeacherId) {
      const teacherBucket = teacherStats.get(effectiveTeacherId) ?? {
        counter: emptyCounter(),
        periods: new Set<string>(),
        classNames: new Set<string>(),
      }
      countStatus(teacherBucket.counter, row.status)
      teacherBucket.periods.add(`${row.classId}:${dayKey(row.date)}`)
      teacherBucket.classNames.add(classItem?.name ?? "Unknown class")
      teacherStats.set(effectiveTeacherId, teacherBucket)
    }

    if (studentMap.has(row.studentId)) {
      const studentCounter = studentStats.get(row.studentId) ?? emptyCounter()
      countStatus(studentCounter, row.status)
      studentStats.set(row.studentId, studentCounter)
    }
  }

  const teacherPerformance = Array.from(teacherStats.entries())
    .map(([teacherId, stats]) => {
      const teacher = teacherMap.get(teacherId)
      const metrics = finalizeCounter(stats.counter)
      return {
        teacherId,
        teacherName: teacher?.name ?? "Unknown teacher",
        teacherEmail: teacher?.email ?? "",
        isActive: teacher?.isActive ?? false,
        classes: Array.from(stats.classNames).sort((a, b) => a.localeCompare(b)),
        teachingPeriods: stats.periods.size,
        performance: getPerformance(metrics.attendanceRate),
        ...metrics,
      }
    })
    .filter((row) => row.isActive || row.records > 0)
    .sort((a, b) => {
      if (a.attendanceRate === null && b.attendanceRate === null) return a.teacherName.localeCompare(b.teacherName)
      if (a.attendanceRate === null) return 1
      if (b.attendanceRate === null) return -1
      return b.attendanceRate - a.attendanceRate
    })

  const classComparison = Array.from(classStats.entries())
    .map(([classId, stats]) => {
      const classItem = classMap.get(classId)
      return {
        classId,
        className: classItem?.name ?? "Unknown class",
        teacherName: classItem?.teacher?.name ?? null,
        studentCount: classStudentCounts.get(classId) ?? 0,
        teachingPeriods: stats.periods.size,
        ...finalizeCounter(stats.counter),
      }
    })
    .filter((row) => classMap.get(row.classId)?.isActive || row.records > 0)
    .sort((a, b) => {
      if (a.attendanceRate === null && b.attendanceRate === null) return a.className.localeCompare(b.className)
      if (a.attendanceRate === null) return 1
      if (b.attendanceRate === null) return -1
      return b.attendanceRate - a.attendanceRate
    })

  const evaluatedStudents = Array.from(studentStats.entries()).map(([studentId, counter]) => ({
    studentId,
    metrics: finalizeCounter(counter),
  }))

  const lowAttendanceStudents = evaluatedStudents
    .filter((row) => row.metrics.attendanceRate !== null && row.metrics.attendanceRate < threshold)
    .map(({ studentId, metrics }) => {
      const student = studentMap.get(studentId)
      return {
        studentId,
        studentCode: student?.studentCode ?? null,
        studentName: student ? `${student.firstName} ${student.lastName}`.trim() : "Unknown student",
        phone: student?.phone ?? null,
        className: student?.class?.name ?? null,
        ...metrics,
      }
    })
    .sort((a, b) => (a.attendanceRate ?? 0) - (b.attendanceRate ?? 0) || a.studentName.localeCompare(b.studentName))

  return {
    range: {
      month: range.month,
      label: range.label,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    threshold,
    summary: {
      ...finalizeCounter(overallCounter),
      teachingPeriods: overallPeriods.size,
      teachersReporting: teacherPerformance.filter((row) => row.teachingPeriods > 0).length,
      classesReporting: classComparison.filter((row) => row.teachingPeriods > 0).length,
      studentsEvaluated: evaluatedStudents.filter((row) => row.metrics.attendanceRate !== null).length,
      lowAttendanceStudents: lowAttendanceStudents.length,
    },
    teacherPerformance,
    classComparison,
    lowAttendanceStudents,
  }
}
