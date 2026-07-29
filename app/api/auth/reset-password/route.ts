import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { isPasswordValid } from "@/lib/password-utils"
import { findValidPasswordResetToken } from "@/lib/password-reset"

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json()
    if (!body || typeof body !== "object") {
      return NextResponse.json({ message: "Invalid body" }, { status: 400 })
    }

    const { token, password, confirmPassword } = body as {
      token?: unknown
      password?: unknown
      confirmPassword?: unknown
    }

    if (typeof token !== "string" || !token.trim()) {
      return NextResponse.json({ message: "Reset token is required" }, { status: 400 })
    }
    if (typeof password !== "string" || !isPasswordValid(password)) {
      return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 })
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ message: "Passwords do not match" }, { status: 400 })
    }

    const record = await findValidPasswordResetToken(token)
    if (!record) {
      return NextResponse.json({ message: "Invalid or expired reset link" }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId, NOT: { id: record.id } },
      }),
      prisma.refreshSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: "Password updated. You can sign in with your new password.",
    })
  } catch (error) {
    console.error("[api/auth/reset-password]", error)
    return NextResponse.json({ message: "Failed to reset password" }, { status: 500 })
  }
}
