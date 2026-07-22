import { createHash, randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { getAppBaseUrl } from "@/lib/password-utils"
import { getBrandName } from "@/lib/brand"
import { sendEmail } from "@/lib/email"

const TOKEN_TTL_MS = 60 * 60 * 1000

export function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.EMAIL_FROM?.trim(),
  )
}

function hashResetToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex")
}

export async function createPasswordResetToken(userId: string) {
  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = hashResetToken(rawToken)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  await prisma.passwordResetToken.deleteMany({
    where: { userId, usedAt: null },
  })

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  })

  return { rawToken, expiresAt }
}

export async function findValidPasswordResetToken(rawToken: string) {
  const tokenHash = hashResetToken(rawToken.trim())
  const now = new Date()

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, email: true, name: true, isActive: true } },
    },
  })

  if (!record || record.usedAt || record.expiresAt <= now) return null
  if (!record.user.isActive) return null
  return record
}

export async function markPasswordResetTokenUsed(id: string) {
  await prisma.passwordResetToken.update({
    where: { id },
    data: { usedAt: new Date() },
  })
}

export async function sendPasswordResetEmail(args: { email: string; name: string; rawToken: string }) {
  const brand = getBrandName()
  const resetUrl = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(args.rawToken)}`
  const subject = `${brand} — Reset your password`
  const text =
    `Hello ${args.name},\n\n` +
    `We received a request to reset your password for ${brand}.\n\n` +
    `Open this link to choose a new password (valid for 1 hour):\n${resetUrl}\n\n` +
    `If you did not request this, you can ignore this email.\n`

  const html = `
    <p>Hello ${args.name},</p>
    <p>We received a request to reset your password for <strong>${brand}</strong>.</p>
    <p><a href="${resetUrl}">Click here to reset your password</a> (link expires in 1 hour).</p>
    <p>If you did not request this, you can ignore this email.</p>
  `

  return sendEmail({
    to: args.email,
    subject,
    text,
    html,
  })
}
