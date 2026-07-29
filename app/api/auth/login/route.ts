import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizeLoginEmail } from "@/lib/password-utils";
import { normalizeRole } from "@/lib/auth";
import { getAllowedRoutesForRole } from "@/lib/permissions";
import { REFRESH_IDLE_TTL_SECONDS, REFRESH_SESSION_TTL_SECONDS } from "@/lib/session-config";
import {
  generateRefreshToken,
  hashRefreshToken,
  setAccessCookie,
  setRefreshCookie,
  signAccessToken,
} from "@/lib/session-tokens";

export async function POST(req: Request) {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    return NextResponse.json({ message: "Server misconfigured" }, { status: 500 })
  }
  let body: { email?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ message: "Email & password required" }, { status: 400 });
  }

  const normalizedEmail = normalizeLoginEmail(String(email));

  let user;
  try {
    user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  } catch (error) {
    console.error("Login database error:", error);
    return NextResponse.json(
      { message: "Database connection failed. Check DATABASE_URL in .env and restart the server." },
      { status: 503 },
    );
  }

  if (!user || !user.isActive) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const role = normalizeRole(user.role);
  if (!role) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(String(password), user.password);
  if (!ok) return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });

  const allowedRoutes = await getAllowedRoutesForRole(role);
  const accessToken = await signAccessToken({ userId: user.id, role, allowedRoutes })
  const refreshToken = generateRefreshToken()
  const now = new Date()
  const refreshExpiresAt = new Date(now.getTime() + REFRESH_SESSION_TTL_SECONDS * 1000)
  const idleExpiresAt = new Date(now.getTime() + REFRESH_IDLE_TTL_SECONDS * 1000)

  await prisma.$transaction([
    prisma.refreshSession.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lte: now } },
          { idleExpiresAt: { lte: now } },
          { revokedAt: { not: null } },
        ],
      },
    }),
    prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiresAt,
        idleExpiresAt,
        lastUsedAt: now,
      },
    }),
  ])

  const res = NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role,
  });

  setAccessCookie(res, accessToken)
  setRefreshCookie(res, refreshToken)

  return res;
}
