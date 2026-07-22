import { prisma } from "@/lib/prisma"
import { buildPartnerSummary, type PartnerSummary } from "@/lib/partner-utils"

async function getStudentCounts(classIds: string[]) {
  if (!classIds.length) return new Map<string, number>()

  const counts = await prisma.student.groupBy({
    by: ["classId"],
    where: { classId: { in: classIds }, isActive: true },
    _count: { _all: true },
  })

  return new Map(counts.filter((row) => row.classId).map((row) => [row.classId!, row._count._all]))
}

async function getPayoutTotals(partnerIds: string[]) {
  if (!partnerIds.length) return new Map<string, number>()

  const totals = await prisma.partnerPayout.groupBy({
    by: ["partnerId"],
    where: { partnerId: { in: partnerIds } },
    _sum: { amount: true },
  })

  return new Map(totals.map((row) => [row.partnerId, row._sum.amount ?? 0]))
}

export async function getPartnerSummaryById(partnerId: string): Promise<PartnerSummary | null> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: {
      classes: {
        include: { class: { select: { id: true, name: true, level: true } } },
        orderBy: { class: { name: "asc" } },
      },
    },
  })

  if (!partner) return null

  const classIds = partner.classes.map((link) => link.classId)
  const studentCounts = await getStudentCounts(classIds)

  const payoutTotal = await prisma.partnerPayout.aggregate({
    where: { partnerId },
    _sum: { amount: true },
  })

  return buildPartnerSummary({
    id: partner.id,
    name: partner.name,
    contactName: partner.contactName,
    phone: partner.phone,
    email: partner.email,
    feePerStudent: partner.feePerStudent,
    isActive: partner.isActive,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
    classes: partner.classes.map((link) => ({
      id: link.id,
      feePerStudent: link.feePerStudent,
      class: link.class,
    })),
    studentCounts,
    payoutTotal: payoutTotal._sum.amount ?? 0,
  })
}

export async function mapPartners(includeInactive: boolean): Promise<PartnerSummary[]> {
  const partners = await prisma.partner.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      classes: {
        include: {
          class: { select: { id: true, name: true, level: true } },
        },
        orderBy: { class: { name: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  })

  const classIds = Array.from(new Set(partners.flatMap((partner) => partner.classes.map((link) => link.classId))))
  const studentCounts = await getStudentCounts(classIds)
  const payoutTotals = await getPayoutTotals(partners.map((partner) => partner.id))

  return partners.map((partner) =>
    buildPartnerSummary({
      id: partner.id,
      name: partner.name,
      contactName: partner.contactName,
      phone: partner.phone,
      email: partner.email,
      feePerStudent: partner.feePerStudent,
      isActive: partner.isActive,
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
      classes: partner.classes.map((link) => ({
        id: link.id,
        feePerStudent: link.feePerStudent,
        class: link.class,
      })),
      studentCounts,
      payoutTotal: payoutTotals.get(partner.id) ?? 0,
    }),
  )
}

export async function syncPartnerClasses(partnerId: string, partnerFee: number, classIds: string[]) {
  const uniqueClassIds = Array.from(new Set(classIds))

  if (uniqueClassIds.length) {
    const existingClasses = await prisma.class.findMany({
      where: { id: { in: uniqueClassIds } },
      select: { id: true },
    })

    if (existingClasses.length !== uniqueClassIds.length) {
      return { error: "One or more selected classes were not found" as const, status: 400 as const }
    }

    const conflicts = await prisma.partnerClass.findMany({
      where: {
        classId: { in: uniqueClassIds },
        NOT: { partnerId },
      },
      include: { class: { select: { name: true } }, partner: { select: { name: true } } },
    })

    if (conflicts.length) {
      const names = conflicts.map((row) => `${row.class.name} (${row.partner.name})`).join(", ")
      return { error: `Class already assigned to another partner: ${names}` as const, status: 409 as const }
    }
  }

  await prisma.partnerClass.deleteMany({ where: { partnerId } })

  if (uniqueClassIds.length) {
    await prisma.partnerClass.createMany({
      data: uniqueClassIds.map((classId) => ({
        partnerId,
        classId,
        feePerStudent: partnerFee,
      })),
    })
  }

  return { ok: true as const }
}

export async function validateClassIds(classIds: string[]) {
  if (!classIds.length) return true
  const count = await prisma.class.count({ where: { id: { in: classIds } } })
  return count === classIds.length
}
