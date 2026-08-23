ALTER TABLE "Payment"
ADD COLUMN "receiptNumber" SERIAL NOT NULL,
ADD COLUMN "feeAmountSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "totalPaidSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "balanceSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "statusSnapshot" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

WITH payment_running_totals AS (
  SELECT
    p.id,
    s."feeAmount" AS fee_amount,
    SUM(p.amount) OVER (
      PARTITION BY p."studentId"
      ORDER BY p."paidAt", p."createdAt", p.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS total_paid
  FROM "Payment" p
  INNER JOIN "Student" s ON s.id = p."studentId"
)
UPDATE "Payment" p
SET
  "feeAmountSnapshot" = ROUND(r.fee_amount::numeric, 2)::double precision,
  "totalPaidSnapshot" = ROUND(r.total_paid::numeric, 2)::double precision,
  "balanceSnapshot" = ROUND(GREATEST(r.fee_amount - r.total_paid, 0)::numeric, 2)::double precision,
  "statusSnapshot" = CASE
    WHEN r.total_paid <= 0 THEN 'UNPAID'::"PaymentStatus"
    WHEN r.fee_amount <= 0 OR r.total_paid >= r.fee_amount THEN 'PAID'::"PaymentStatus"
    ELSE 'PARTIAL'::"PaymentStatus"
  END
FROM payment_running_totals r
WHERE p.id = r.id;
