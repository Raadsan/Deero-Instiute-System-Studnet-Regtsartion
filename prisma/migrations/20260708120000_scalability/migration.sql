-- Scalability indexes + attendance archive table
CREATE TABLE IF NOT EXISTS "AttendanceArchive" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceArchive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceArchive_originalId_key" ON "AttendanceArchive"("originalId");
CREATE INDEX IF NOT EXISTS "AttendanceArchive_date_idx" ON "AttendanceArchive"("date");
CREATE INDEX IF NOT EXISTS "AttendanceArchive_classId_date_idx" ON "AttendanceArchive"("classId", "date");
CREATE INDEX IF NOT EXISTS "AttendanceArchive_studentId_date_idx" ON "AttendanceArchive"("studentId", "date");

CREATE INDEX IF NOT EXISTS "Student_isActive_paymentStatus_idx" ON "Student"("isActive", "paymentStatus");
CREATE INDEX IF NOT EXISTS "Student_isActive_enrollmentStatus_visitDate_idx" ON "Student"("isActive", "enrollmentStatus", "visitDate");
CREATE INDEX IF NOT EXISTS "Student_createdAt_idx" ON "Student"("createdAt");

CREATE INDEX IF NOT EXISTS "User_role_isActive_idx" ON "User"("role", "isActive");

CREATE INDEX IF NOT EXISTS "Attendance_studentId_classId_status_date_idx" ON "Attendance"("studentId", "classId", "status", "date");

CREATE INDEX IF NOT EXISTS "FinanceEntry_type_occurredAt_idx" ON "FinanceEntry"("type", "occurredAt");
