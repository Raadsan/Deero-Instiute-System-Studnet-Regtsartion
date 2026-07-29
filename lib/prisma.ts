import { PrismaClient } from "@/lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: pg.Pool | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new pg.Pool({ connectionString })
  }

  const adapter = new PrismaPg(globalForPrisma.pgPool)
  return new PrismaClient({ adapter })
}

function isStalePrismaClient(client: PrismaClient) {
  if (!("partner" in client) || !("teacherContract" in client) || !("staff" in client) || !("financeEntry" in client)) {
    return true
  }

  const runtime = (client as unknown as {
    _runtimeDataModel?: { models?: Record<string, { fields?: Array<{ name: string }> }> }
  })._runtimeDataModel
  const paymentFields = runtime?.models?.Payment?.fields?.map((field) => field.name) ?? []
  if (!paymentFields.includes("recordedById")) return true
  const studentFields = runtime?.models?.Student?.fields?.map((field) => field.name) ?? []
  if (!studentFields.includes("studentCode")) return true

  const hasPasswordReset = "passwordResetToken" in client
  const hasAttendanceArchive = "attendanceArchive" in client
  return !hasPasswordReset || !hasAttendanceArchive
}

function getPrismaClient() {
  const cached = globalForPrisma.prisma
  if (cached && isStalePrismaClient(cached)) {
    globalForPrisma.prisma = undefined
  }

  const fresh = globalForPrisma.prisma
  if (fresh && !isStalePrismaClient(fresh)) {
    return fresh
  }

  const client = createPrismaClient()
  globalForPrisma.prisma = client
  return client
}

export const prisma = getPrismaClient()
