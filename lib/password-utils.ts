export function normalizeLoginEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (normalized === "admin@deeroinstitute.com" || normalized === "admin@sodma.com" || normalized === "admin@sodma") return "admin@deeroinstitute"
  if (normalized === "admission@deeroinstitute.com" || normalized === "admission@sodma.com" || normalized === "admission@sodma") return "admission@deeroinstitute"
  if (normalized === "finance@deeroinstitute.com" || normalized === "finance@sodma.com" || normalized === "finance@sodma") return "finance@deeroinstitute"
  return normalized
}

export function getAppBaseUrl() {
  const fromEnv = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  return "http://localhost:3000"
}

export function isPasswordValid(password: string) {
  return password.length >= 6
}
