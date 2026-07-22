/** Accept common shorthand emails at login (e.g. admin@sodma → stored admin@sodma). */
export function normalizeLoginEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (normalized === "admin@sodma.com") return "admin@sodma"
  if (normalized === "admission@sodma.com") return "admission@sodma"
  if (normalized === "finance@sodma.com") return "finance@sodma"
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
