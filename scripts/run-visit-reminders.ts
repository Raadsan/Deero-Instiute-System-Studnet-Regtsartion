import "dotenv/config"
import { processVisitReminders } from "../lib/visit-reminders"

async function main() {
  const result = await processVisitReminders()
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
