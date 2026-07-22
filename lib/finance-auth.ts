import type { AppRole, AppSession } from "@/lib/auth"

export function canAccessFinance(role: AppRole) {
  return role === "ADMIN" || role === "FINANCE"
}

export function requireFinanceSession(session: AppSession | null) {
  if (!session) return { ok: false as const, status: 401, message: "Unauthorized" }
  if (!canAccessFinance(session.role)) return { ok: false as const, status: 403, message: "Forbidden" }
  return { ok: true as const, session }
}

export function requireAdminSession(session: AppSession | null) {
  if (!session) return { ok: false as const, status: 401, message: "Unauthorized" }
  if (session.role !== "ADMIN") return { ok: false as const, status: 403, message: "Forbidden" }
  return { ok: true as const, session }
}
