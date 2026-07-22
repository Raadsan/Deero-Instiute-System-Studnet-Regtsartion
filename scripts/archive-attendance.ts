import "dotenv/config"
import { archiveOldAttendance } from "../lib/attendance-archive"

async function main() {
  const days = Number(process.env.ATTENDANCE_ARCHIVE_AFTER_DAYS ?? 365) || 365
  const result = await archiveOldAttendance(days)
  console.log("Attendance archive complete:", result)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
