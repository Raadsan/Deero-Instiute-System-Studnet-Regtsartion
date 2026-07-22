-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('SALARY', 'PERCENTAGE');

-- CreateTable
CREATE TABLE "TeacherContract" (
    "id" TEXT NOT NULL,
    "compensationType" "CompensationType" NOT NULL,
    "salaryAmount" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherContractPayout" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "period" TEXT,
    "contractId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherContractPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherContract_teacherId_idx" ON "TeacherContract"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherContract_classId_idx" ON "TeacherContract"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherContract_teacherId_classId_key" ON "TeacherContract"("teacherId", "classId");

-- CreateIndex
CREATE INDEX "TeacherContractPayout_contractId_idx" ON "TeacherContractPayout"("contractId");

-- CreateIndex
CREATE INDEX "TeacherContractPayout_paidAt_idx" ON "TeacherContractPayout"("paidAt");

-- AddForeignKey
ALTER TABLE "TeacherContract" ADD CONSTRAINT "TeacherContract_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherContract" ADD CONSTRAINT "TeacherContract_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherContractPayout" ADD CONSTRAINT "TeacherContractPayout_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "TeacherContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
