import { NextResponse } from "next/server"

import { getSessionFromRequestCookies } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export async function GET() {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "TEACHER") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const classes = await prisma.class.findMany({
    where: { teacherId: session.userId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const classIds = classes.map((item) => item.id)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - 6)
  const end = new Date(today)
  end.setDate(end.getDate() + 1)

  const records = classIds.length
    ? await prisma.attendance.findMany({
        where: {
          classId: { in: classIds },
          date: { gte: start, lt: end },
          student: { isHidden: false },
        },
        select: { classId: true, date: true, status: true },
      })
    : []

  const dailyMap = new Map<string, { present: number; absent: number }>()
  const classMap = new Map<string, { present: number; absent: number }>()
  let present = 0
  let absent = 0

  for (const record of records) {
    const daily = dailyMap.get(dayKey(record.date)) ?? { present: 0, absent: 0 }
    const classCount = classMap.get(record.classId) ?? { present: 0, absent: 0 }
    if (record.status === "PRESENT" || record.status === "LATE") {
      daily.present++
      classCount.present++
      present++
    } else if (record.status === "ABSENT") {
      daily.absent++
      classCount.absent++
      absent++
    }
    dailyMap.set(dayKey(record.date), daily)
    classMap.set(record.classId, classCount)
  }

  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const count = dailyMap.get(dayKey(date)) ?? { present: 0, absent: 0 }
    return {
      label: date.toLocaleDateString("en", { weekday: "short" }),
      ...count,
    }
  })

  const byClass = classes.map((item) => {
    const count = classMap.get(item.id) ?? { present: 0, absent: 0 }
    const period = count.present + count.absent
    return {
      name: item.name,
      present: count.present,
      absent: count.absent,
      rate: period ? Math.round((count.present / period) * 10000) / 100 : 0,
    }
  })

  const total = present + absent
  return NextResponse.json({
    present,
    absent,
    rate: total ? Math.round((present / total) * 10000) / 100 : 0,
    daily,
    byClass,
  })
}
