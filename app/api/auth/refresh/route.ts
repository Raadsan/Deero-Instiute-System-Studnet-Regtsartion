import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

import { normalizeRole } from "@/lib/auth"
import { getAllowedRoutesForRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  REFRESH_IDLE_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/session-config"
import {
  clearSessionCookies,
  generateRefreshToken,
  hashRefreshToken,
  setAccessCookie,
  setRefreshCookie,
  signAccessToken,
} from "@/lib/session-tokens"

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/"
  return value
}

async function rotateRefreshSession() {
  const currentToken = (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value
  if (!currentToken) return null

  const now = new Date()
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash: hashRefreshToken(currentToken) },
    include: {
      user: { select: { id: true, role: true, isActive: true } },
    },
  })

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= now ||
    session.idleExpiresAt <= now ||
    !session.user.isActive
  ) {
    if (session && !session.revokedAt) {
      await prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: now },
      })
    }
    return null
  }

  const role = normalizeRole(session.user.role)
  if (!role) return null

  const nextToken = generateRefreshToken()
  const allowedRoutes = await getAllowedRoutesForRole(role)
  const accessToken = await signAccessToken({
    userId: session.user.id,
    role,
    allowedRoutes,
  })
  const idleExpiresAt = new Date(
    Math.min(
      session.expiresAt.getTime(),
      now.getTime() + REFRESH_IDLE_TTL_SECONDS * 1000,
    ),
  )
  const rotated = await prisma.refreshSession.updateMany({
    where: {
      id: session.id,
      tokenHash: hashRefreshToken(currentToken),
      revokedAt: null,
    },
    data: {
      tokenHash: hashRefreshToken(nextToken),
      lastUsedAt: now,
      idleExpiresAt,
    },
  })
  if (rotated.count !== 1) return null

  return {
    accessToken,
    refreshToken: nextToken,
    remainingSeconds: Math.max(
      0,
      Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000),
    ),
  }
}

function applyRotatedCookies(
  response: NextResponse,
  rotated: NonNullable<Awaited<ReturnType<typeof rotateRefreshSession>>>,
) {
  setAccessCookie(response, rotated.accessToken)
  setRefreshCookie(response, rotated.refreshToken, rotated.remainingSeconds)
}

export async function POST() {
  const rotated = await rotateRefreshSession()
  if (!rotated) {
    const response = NextResponse.json({ message: "Session expired" }, { status: 401 })
    clearSessionCookies(response)
    return response
  }

  const response = NextResponse.json({ ok: true })
  applyRotatedCookies(response, rotated)
  return response
}

export async function GET(req: NextRequest) {
  const returnTo = safeReturnPath(req.nextUrl.searchParams.get("returnTo"))
  const rotated = await rotateRefreshSession()
  if (!rotated) {
    const response = NextResponse.redirect(new URL("/?session=expired", req.url))
    clearSessionCookies(response)
    return response
  }

  const response = NextResponse.redirect(new URL(returnTo, req.url))
  applyRotatedCookies(response, rotated)
  return response
}
