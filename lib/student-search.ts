import type { Prisma } from "@/lib/generated/prisma/client"

export function buildStudentSearchFilter(search: string): Prisma.StudentWhereInput | undefined {
  const q = search.trim()
  if (!q) return undefined

  const parts = q.split(/\s+/).filter(Boolean)
  const or: Prisma.StudentWhereInput[] = [
    { firstName: { contains: q, mode: "insensitive" } },
    { lastName: { contains: q, mode: "insensitive" } },
    { email: { contains: q, mode: "insensitive" } },
    { phone: { contains: q, mode: "insensitive" } },
  ]

  if (parts.length >= 2) {
    or.push({
      AND: [
        { firstName: { contains: parts[0], mode: "insensitive" } },
        { lastName: { contains: parts.slice(1).join(" "), mode: "insensitive" } },
      ],
    })
  }

  return { OR: or }
}

export function buildTeacherSearchFilter(search: string): Prisma.UserWhereInput | undefined {
  const q = search.trim()
  if (!q) return undefined
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ],
  }
}
