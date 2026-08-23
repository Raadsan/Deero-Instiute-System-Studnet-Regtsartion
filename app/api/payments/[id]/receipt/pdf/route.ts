import { NextResponse } from "next/server"

import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import { buildPaymentReceiptPdf, getPaymentReceipt } from "@/lib/payment-receipt"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: RouteContext) {
  const session = await getSessionFromRequestCookies()
  const auth = requireFinanceSession(session)
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

  const { id } = await params
  const receipt = await getPaymentReceipt(id)
  if (!receipt) return NextResponse.json({ message: "Payment receipt not found" }, { status: 404 })

  const pdf = await buildPaymentReceiptPdf(receipt)
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${receipt.receiptNo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
