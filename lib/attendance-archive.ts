import { prisma } from "@/lib/prisma"

const DEFAULT_ARCHIVE_AFTER_DAYS = 365
const BATCH_SIZE = 500

export async function archiveOldAttendance(olderThanDays = DEFAULT_ARCHIVE_AFTER_DAYS) {
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  let archived = 0
  let deleted = 0

  while (true) {
    const batch = await prisma.attendance.findMany({
      where: { date: { lt: cutoff } },
      take: BATCH_SIZE,
      orderBy: { date: "asc" },
    })

    if (batch.length === 0) break

    await prisma.$transaction(async (tx) => {
      await tx.attendanceArchive.createMany({
        data: batch.map((row) => ({
          originalId: row.id,
          date: row.date,
          status: row.status,
          note: row.note,
          studentId: row.studentId,
          classId: row.classId,
          teacherId: row.teacherId,
          recordedAt: row.createdAt,
        })),
        skipDuplicates: true,
      })

      await tx.attendance.deleteMany({
        where: { id: { in: batch.map((row) => row.id) } },
      })
    })

    archived += batch.length
    deleted += batch.length
  }

  return { archived, deleted, cutoff: cutoff.toISOString() }
}
