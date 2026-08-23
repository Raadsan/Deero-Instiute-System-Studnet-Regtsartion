export type StudentPaymentStatus = "PAID" | "PARTIAL" | "UNPAID"

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function getStudentPaymentStatus(feeAmount: number, totalPaid: number): StudentPaymentStatus {
  const fee = roundMoney(Math.max(0, feeAmount))
  const paid = roundMoney(Math.max(0, totalPaid))

  if (paid <= 0) return "UNPAID"
  if (fee <= 0 || paid >= fee) return "PAID"
  return "PARTIAL"
}

export function getStudentFeeBalances(feeAmount: number, totalPaid: number) {
  const fee = roundMoney(Math.max(0, feeAmount))
  const paid = roundMoney(Math.max(0, totalPaid))

  return {
    feeAmount: fee,
    totalPaid: paid,
    remainingBalance: roundMoney(Math.max(0, fee - paid)),
    creditBalance: roundMoney(Math.max(0, paid - fee)),
  }
}
