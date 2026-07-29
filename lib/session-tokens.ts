import { createHash, randomBytes } from "node:crypto"
import { SignJWT } from "jose"
import type { NextResponse } from "next/server"

import type { AppRole } from "@/lib/auth"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_SESSION_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/session-config"

export function generateRefreshToken() {
  return randomBytes(32).toString("base64url")
}

export function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function signAccessToken(args: {
  userId: string
  role: AppRole
  allowedRoutes: string[]
}) {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) throw new Error("JWT_SECRET is not configured")

  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS
  return new SignJWT({
    role: args.role,
    allowedRoutes: args.allowedRoutes,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(args.userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(jwtSecret))
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
}

export function setAccessCookie(response: NextResponse, token: string) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, token, {
    ...cookieBase,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  })
}

export function setRefreshCookie(
  response: NextResponse,
  token: string,
  remainingLifetimeSeconds = REFRESH_SESSION_TTL_SECONDS,
) {
  response.cookies.set(REFRESH_TOKEN_COOKIE, token, {
    ...cookieBase,
    maxAge: Math.max(0, remainingLifetimeSeconds),
  })
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]) {
    response.cookies.set(name, "", {
      ...cookieBase,
      maxAge: 0,
      expires: new Date(0),
    })
  }
}
