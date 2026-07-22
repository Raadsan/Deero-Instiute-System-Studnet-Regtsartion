export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startVisitReminderCron } = await import("@/lib/visit-reminder-cron")
    startVisitReminderCron()
  }
}
