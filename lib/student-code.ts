import type { Prisma } from "@/lib/generated/prisma/client"

export function studentCodePrefix(className?: string | null) {
  if (!className?.trim()) return "STU"

  const prefix = className
    .trim()
    .split(/\s+/)
    .map((part) => (/^batch\d*$/i.test(part) ? part : part[0]))
    .join("")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()

  return prefix || "STU"
}

export async function nextStudentCode(
  tx: Prisma.TransactionClient,
  className?: string | null,
) {
  const prefix = studentCodePrefix(className)
  const existing = await tx.student.findMany({
    where: { studentCode: { startsWith: `${prefix}-` } },
    select: { studentCode: true },
  })

  const lastNumber = existing.reduce(
    (highest, student) =>
      Math.max(highest, Number(student.studentCode?.split("-").at(-1)) || 0),
    0,
  )
  return `${prefix}-${String(lastNumber + 1).padStart(3, "0")}`
}
