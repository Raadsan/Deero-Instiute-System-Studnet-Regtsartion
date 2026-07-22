import { processVisitReminders } from "@/lib/visit-reminders"

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_HOUR = 7
const DEFAULT_MINUTE = 0

function parseDailyTime(): { hour: number; minute: number } {
  const raw = process.env.VISIT_REMINDER_CRON_TIME?.trim()
  if (!raw) return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE }

  const match = /^(\d{1,2}):(\d{2})$/.exec(raw)
  if (!match) return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE }

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE }
  }

  return { hour, minute }
}

function msUntilNextRun(hour: number, minute: number, from = new Date()): number {
  const next = new Date(from)
  next.setHours(hour, minute, 0, 0)
  if (next <= from) {
    next.setDate(next.getDate() + 1)
  }
  return next.getTime() - from.getTime()
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

let started = false
let timeoutId: ReturnType<typeof setTimeout> | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

async function runVisitReminderJob(source: "cron" | "startup") {
  try {
    console.log(`[visit-reminder-cron] Running visit reminders (${source})...`)
    const result = await processVisitReminders()
    console.log(
      `[visit-reminder-cron] Done: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped (${result.total} due today)`,
    )
  } catch (error) {
    console.error("[visit-reminder-cron] Failed:", error)
  }
}

function scheduleDailyRun(hour: number, minute: number) {
  const delay = msUntilNextRun(hour, minute)
  console.log(
    `[visit-reminder-cron] Next run at ${formatTime(hour, minute)} local time (in ${Math.round(delay / 60000)} minutes)`,
  )

  timeoutId = setTimeout(async () => {
    await runVisitReminderJob("cron")
    intervalId = setInterval(() => {
      void runVisitReminderJob("cron")
    }, MS_PER_DAY)
  }, delay)
}

export function startVisitReminderCron() {
  if (started) return
  if (process.env.VISIT_REMINDER_CRON_ENABLED === "false") {
    console.log("[visit-reminder-cron] Disabled (VISIT_REMINDER_CRON_ENABLED=false)")
    return
  }

  // Vercel uses vercel.json crons — avoid duplicate runs from serverless instances.
  if (process.env.VERCEL) {
    console.log("[visit-reminder-cron] Skipped on Vercel (uses vercel.json cron)")
    return
  }

  started = true
  const { hour, minute } = parseDailyTime()
  console.log(`[visit-reminder-cron] Enabled — daily at ${formatTime(hour, minute)} local time`)

  if (process.env.VISIT_REMINDER_CRON_RUN_ON_START === "true") {
    void runVisitReminderJob("startup")
  }

  scheduleDailyRun(hour, minute)
}

export function stopVisitReminderCron() {
  if (timeoutId) clearTimeout(timeoutId)
  if (intervalId) clearInterval(intervalId)
  timeoutId = null
  intervalId = null
  started = false
}
