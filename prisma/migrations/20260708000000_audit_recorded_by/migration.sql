-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "recordedById" TEXT;

-- AlterTable
ALTER TABLE "PartnerPayout" ADD COLUMN "recordedById" TEXT;

-- AlterTable
ALTER TABLE "TeacherContractPayout" ADD COLUMN "recordedById" TEXT;

-- AlterTable
ALTER TABLE "StaffSalaryPayout" ADD COLUMN "recordedById" TEXT;

-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN "recordedById" TEXT;

-- CreateIndex
CREATE INDEX "Payment_recordedById_idx" ON "Payment"("recordedById");

-- CreateIndex
CREATE INDEX "PartnerPayout_recordedById_idx" ON "PartnerPayout"("recordedById");

-- CreateIndex
CREATE INDEX "TeacherContractPayout_recordedById_idx" ON "TeacherContractPayout"("recordedById");

-- CreateIndex
CREATE INDEX "StaffSalaryPayout_recordedById_idx" ON "StaffSalaryPayout"("recordedById");

-- CreateIndex
CREATE INDEX "FinanceEntry_recordedById_idx" ON "FinanceEntry"("recordedById");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherContractPayout" ADD CONSTRAINT "TeacherContractPayout_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalaryPayout" ADD CONSTRAINT "StaffSalaryPayout_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
