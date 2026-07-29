import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { isPasswordValid } from "@/lib/password-utils"
import { clearSessionCookies } from "@/lib/session-tokens"

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const body: unknown = await req.json()
    if (!body || typeof body !== "object") {
      return NextResponse.json({ message: "Invalid body" }, { status: 400 })
    }

    const { currentPassword, newPassword, confirmPassword } = body as {
      currentPassword?: unknown
      newPassword?: unknown
      confirmPassword?: unknown
    }

    if (typeof currentPassword !== "string" || !currentPassword) {
      return NextResponse.json({ message: "Current password is required" }, { status: 400 })
    }
    if (typeof newPassword !== "string" || !isPasswordValid(newPassword)) {
      return NextResponse.json({ message: "New password must be at least 6 characters" }, { status: 400 })
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ message: "New passwords do not match" }, { status: 400 })
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ message: "New password must be different" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, password: true, isActive: true },
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const currentOk = await bcrypt.compare(currentPassword, user.password)
    if (!currentOk) {
      return NextResponse.json({ message: "Current password is incorrect" }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    })

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
    await prisma.refreshSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    const response = NextResponse.json({
      success: true,
      message: "Password changed successfully. Please sign in again.",
    })
    clearSessionCookies(response)
    return response
  } catch (error) {
    console.error("[api/auth/change-password]", error)
    return NextResponse.json({ message: "Failed to change password" }, { status: 500 })
  }
}
