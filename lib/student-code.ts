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
  const latest = await tx.student.findFirst({
    where: { studentCode: { startsWith: `${prefix}-` } },
    select: { studentCode: true },
    orderBy: { studentCode: "desc" },
  })

  const lastNumber = Number(latest?.studentCode?.split("-").at(-1)) || 0
  return `${prefix}-${String(lastNumber + 1).padStart(3, "0")}`
}
