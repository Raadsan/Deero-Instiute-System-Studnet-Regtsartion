import type { AppRole } from "@/lib/auth"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { NextResponse } from "next/server"
import { canAccessFinance, requireAdminSession, requireFinanceSession } from "@/lib/finance-auth"

export async function getFinanceApiSession() {
  return getSessionFromRequestCookies()
}

export function financeForbidden() {
  return NextResponse.json({ message: "Forbidden" }, { status: 403 })
}

export function financeUnauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
}

export async function assertFinanceReadAccess() {
  const session = await getSessionFromRequestCookies()
  const auth = requireFinanceSession(session)
  if (!auth.ok) return { ok: false as const, response: NextResponse.json({ message: auth.message }, { status: auth.status }) }
  return { ok: true as const, session: auth.session }
}

export async function assertAdminWriteAccess() {
  const session = await getSessionFromRequestCookies()
  const auth = requireAdminSession(session)
  if (!auth.ok) return { ok: false as const, response: NextResponse.json({ message: auth.message }, { status: auth.status }) }
  return { ok: true as const, session: auth.session }
}

export function roleCanReadFinance(role: AppRole) {
  return canAccessFinance(role)
}
