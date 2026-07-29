import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { REFRESH_TOKEN_COOKIE } from "@/lib/session-config"
import { clearSessionCookies, hashRefreshToken } from "@/lib/session-tokens"

export async function POST() {
  const refreshToken = (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value
  if (refreshToken) {
    await prisma.refreshSession.updateMany({
      where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  const res = NextResponse.json({ ok: true })
  clearSessionCookies(res)
  return res
}
