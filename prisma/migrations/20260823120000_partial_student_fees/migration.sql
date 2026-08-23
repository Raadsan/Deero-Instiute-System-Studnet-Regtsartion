ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';

ALTER TABLE "Student"
ADD COLUMN IF NOT EXISTS "feeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Existing paid accounts did not store the expected fee. Preserve their current
-- state by treating the amount already collected as their original fee.
UPDATE "Student" AS s
SET "feeAmount" = COALESCE((
  SELECT SUM(p.amount)
  FROM "Payment" AS p
  WHERE p."studentId" = s.id
), 0)
WHERE s."paymentStatus" = 'PAID'
  AND s."feeAmount" = 0;
