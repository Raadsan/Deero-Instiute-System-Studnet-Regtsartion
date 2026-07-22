import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { normalizeLoginEmail, isPasswordValid } from "@/lib/password-utils"
import {
  createPasswordResetToken,
  isEmailConfigured,
  sendPasswordResetEmail,
} from "@/lib/password-reset"

const GENERIC_MESSAGE =
  "If an account exists for that email, we sent password reset instructions."

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json()
    if (!body || typeof body !== "object") {
      return NextResponse.json({ message: "Invalid body" }, { status: 400 })
    }

    const { email } = body as { email?: unknown }
    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 })
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          message:
            "Email is not configured on this server. Contact your administrator to reset your password.",
        },
        { status: 503 },
      )
    }

    const normalizedEmail = normalizeLoginEmail(email)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, isActive: true },
    })

    if (user?.isActive) {
      const { rawToken } = await createPasswordResetToken(user.id)
      const result = await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        rawToken,
      })

      if (!result.ok) {
        console.error("[forgot-password] email failed:", result.error)
      }
    }

    return NextResponse.json({ success: true, message: GENERIC_MESSAGE })
  } catch (error) {
    console.error("[api/auth/forgot-password]", error)
    return NextResponse.json({ message: "Failed to process request" }, { status: 500 })
  }
}
