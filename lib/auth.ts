import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import { prisma } from "@/lib/prisma"
import { getCachedSession, setCachedSession } from "@/lib/session-cache"
import { SESSION_TTL_SECONDS } from "@/lib/session-config"

export type AppRole = "ADMIN" | "TEACHER" | "REGISTRAR" | "FINANCE"

export type AppSession = {
  userId: string
  role: AppRole
}

/** Legacy DB/JWT value before enum rename */
const LEGACY_REGISTRAR_ROLE = "Register"

export function normalizeRole(role: unknown): AppRole | null {
  if (role === LEGACY_REGISTRAR_ROLE) return "REGISTRAR"
  if (role === "ADMIN" || role === "TEACHER" || role === "REGISTRAR" || role === "FINANCE") return role
  return null
}

export function financeRoleFilter() {
  return { role: { in: ["FINANCE" as const] } }
}

export function canAccessFinance(role: AppRole) {
  return role === "ADMIN" || role === "FINANCE"
}

export function registrarRoleFilter() {
  return { role: { in: ["REGISTRAR" as const] } }
}

export function canManageStudents(role: AppRole) {
  return role === "ADMIN" || role === "REGISTRAR"
}

export async function getSessionFromRequestCookies(): Promise<AppSession | null> {
  const token = (await cookies()).get("token")?.value
  if (!token) return null

  const secret = process.env.JWT_SECRET
  if (!secret) return null

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      maxTokenAge: SESSION_TTL_SECONDS,
    })
    const userId = typeof payload.sub === "string" ? payload.sub : null
    if (!userId) return null

    const cached = getCachedSession(userId)
    if (cached) return cached

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    })
    if (!user?.isActive) return null

    const role = normalizeRole(user.role)
    if (!role) return null

    const session = { userId: user.id, role }
    setCachedSession(userId, session)
    return session
  } catch {
    return null
  }
}

export async function getRoleFromRequestCookies(): Promise<AppRole | null> {
  const session = await getSessionFromRequestCookies()
  return session?.role ?? null
}
