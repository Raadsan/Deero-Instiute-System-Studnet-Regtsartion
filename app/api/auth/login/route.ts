import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { normalizeLoginEmail } from "@/lib/password-utils";
import { normalizeRole } from "@/lib/auth";
import { getAllowedRoutesForRole } from "@/lib/permissions";
import { SESSION_TTL_SECONDS } from "@/lib/session-config";

export async function POST(req: Request) {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    return NextResponse.json({ message: "Server misconfigured" }, { status: 500 })
  }
  const secret = new TextEncoder().encode(jwtSecret)

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
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await new SignJWT({ sub: user.id, role, allowedRoutes })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);

  const res = NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role,
  });

  res.cookies.set("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return res;
}
