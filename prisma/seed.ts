import "dotenv/config"
import bcrypt from "bcryptjs"
import { prisma } from "../lib/prisma"

async function main() {
  const adminPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "pasowrdsodam123", 10)
  const teacherPassword = await bcrypt.hash(process.env.SEED_TEACHER_PASSWORD ?? "teacher123", 10)
  const registrarPassword = await bcrypt.hash(process.env.SEED_REGISTRAR_PASSWORD ?? "register123", 10)
  const financePassword = await bcrypt.hash(process.env.SEED_FINANCE_PASSWORD ?? "finance123", 10)

  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["admin@deeroinst6.com", "admin@deeroinstitute.com", "admission@deeroinst6.com"],
      },
    },
  })

  await prisma.user.upsert({
    where: { email: "admin@deeroinstitute" },
    update: {
      name: "System Admin",
      role: "ADMIN",
      isActive: true,
      password: adminPassword,
    },
    create: {
      name: "System Admin",
      email: "admin@deeroinstitute",
      role: "ADMIN",
      isActive: true,
      password: adminPassword,
    },
  })

  await prisma.user.upsert({
    where: { email: "teacher@school.com" },
    update: {
      name: "Main Teacher",
      role: "TEACHER",
      isActive: true,
    },
    create: {
      name: "Main Teacher",
      email: "teacher@school.com",
      role: "TEACHER",
      isActive: true,
      password: teacherPassword,
    },
  })

  await prisma.user.upsert({
    where: { email: "admission@deeroinstitute" },
    update: {
      name: "Admission Staff",
      role: "REGISTRAR",
      isActive: true,
      password: registrarPassword,
    },
    create: {
      name: "Admission Staff",
      email: "admission@deeroinstitute",
      role: "REGISTRAR",
      isActive: true,
      password: registrarPassword,
    },
  })

  await prisma.user.upsert({
    where: { email: "finance@deeroinstitute" },
    update: {
      name: "Finance Officer",
      role: "FINANCE",
      isActive: true,
      password: financePassword,
    },
    create: {
      name: "Finance Officer",
      email: "finance@deeroinstitute",
      role: "FINANCE",
      isActive: true,
      password: financePassword,
    },
  })

  console.log("Seed completed")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
