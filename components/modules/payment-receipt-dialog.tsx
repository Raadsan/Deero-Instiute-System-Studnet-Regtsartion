"use client"

import { useEffect, useRef, useState } from "react"
import { Download, Printer, ReceiptText } from "lucide-react"

import { api } from "@/lib/api"
import type { PaymentReceiptData } from "@/lib/payment-receipt"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"

type PaymentReceiptDialogProps = {
  paymentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(new Date(value))
}

function statusClass(status: PaymentReceiptData["status"]) {
  if (status === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "PARTIAL") return "border-blue-200 bg-blue-50 text-blue-700"
  return "border-amber-200 bg-amber-50 text-amber-700"
}

export default function PaymentReceiptDialog({ paymentId, open, onOpenChange }: PaymentReceiptDialogProps) {
  const [receipt, setReceipt] = useState<PaymentReceiptData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const receiptRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open || !paymentId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setReceipt(null)

    void api
      .get<PaymentReceiptData>(`/api/payments/${paymentId}/receipt`)
      .then((response) => {
        if (!cancelled) setReceipt(response.data)
      })
      .catch((requestError) => {
        if (!cancelled) setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, paymentId])

  const downloadPdf = async () => {
    if (!paymentId || !receipt) return
    setDownloading(true)
    try {
      const response = await api.get<Blob>(`/api/payments/${paymentId}/receipt/pdf`, { responseType: "blob" })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement("a")
      link.href = url
      link.download = `${receipt.receiptNo}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (requestError: any) {
      toast({ title: "PDF download failed", description: getErrorMessage(requestError), variant: "destructive" })
    } finally {
      setDownloading(false)
    }
  }

  const printReceipt = () => {
    if (!receipt || !receiptRef.current) return
    const printWindow = window.open("", "_blank", "width=760,height=900")
    if (!printWindow) {
      toast({
        title: "Print window was blocked",
        description: "Allow pop-ups for this site, then try Print again.",
        variant: "destructive",
      })
      return
    }

    const documentStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join("\n")
    const receiptMarkup = receiptRef.current.outerHTML

    printWindow.document.open()
    printWindow.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <base href="${window.location.origin}/" />
          <title>${receipt.receiptNo} - Payment Receipt</title>
          ${documentStyles}
          <style>
            @page { size: A4 portrait; margin: 0; }
            * { box-sizing: border-box; }
            html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            main { width: 210mm; margin: 0; padding: 12mm 31mm; background: white; }
            [data-receipt-print] {
              width: 148mm !important;
              max-width: none !important;
              min-height: 0 !important;
              height: auto !important;
              margin: 0 auto !important;
              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          </style>
        </head>
        <body><main>${receiptMarkup}</main></body>
      </html>`)
    printWindow.document.close()

    const startPrint = () => {
      printWindow.focus()
      printWindow.print()
    }
    printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true })
    if (printWindow.document.readyState === "complete") window.setTimeout(startPrint, 250)
    else printWindow.addEventListener("load", () => window.setTimeout(startPrint, 250), { once: true })
  }

  const contactLine = receipt
    ? [receipt.institute.phone, receipt.institute.website, receipt.institute.email, receipt.institute.address]
        .filter(Boolean)
        .join(" • ")
    : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto border-0 bg-slate-100 p-3 shadow-2xl sm:max-w-2xl sm:p-5">
        <DialogTitle className="sr-only">Payment Receipt</DialogTitle>
        <DialogDescription className="sr-only">View, download, or print this student payment receipt.</DialogDescription>

        {loading ? (
          <div className="flex min-h-[480px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Spinner className="h-8 w-8 text-primary" />
            <p>Loading digital receipt...</p>
          </div>
        ) : error ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-xl bg-white p-8 text-center">
            <ReceiptText className="h-10 w-10 text-destructive" />
            <p className="font-semibold text-destructive">Receipt could not be loaded</p>
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
          </div>
        ) : receipt ? (
          <>
            <article
              ref={receiptRef}
              data-receipt-print
              className="mx-auto w-full max-w-[590px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-sm"
            >
              <header className="relative overflow-hidden bg-[#003D9E] px-6 py-6 text-white sm:px-8">
                <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
                <div className="absolute bottom-0 left-0 h-1 w-full bg-[#EC4724]" />
                <div className="relative flex items-center justify-between gap-5">
                  <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                    <img src={receipt.institute.logoUrl} alt={receipt.institute.name} className="h-12 w-auto object-contain" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-blue-100">Official</p>
                    <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Payment Receipt</h2>
                  </div>
                </div>
              </header>

              <div className="space-y-6 px-6 py-6 sm:px-8">
                <section className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Receipt No</p>
                    <p className="mt-1 font-mono text-base font-bold text-[#003D9E]">{receipt.receiptNo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Payment Date</p>
                    <p className="mt-1 font-semibold">{formatDate(receipt.paidAt)}</p>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#003D9E]">Received From</p>
                  <p className="mt-1 text-lg font-bold capitalize">{receipt.student.name}</p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                    {receipt.student.studentCode && <span>ID: {receipt.student.studentCode}</span>}
                    <span>Class: {receipt.student.className ?? "Unassigned"}</span>
                  </div>
                </section>

                <section className="divide-y divide-slate-200">
                  <div className="flex items-center justify-between py-3 text-sm">
                    <span className="text-slate-600">Total Fee</span>
                    <span className="font-semibold tabular-nums">{formatMoney(receipt.feeAmount, receipt.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="font-semibold text-slate-700">Paid This Time</span>
                    <span className="text-lg font-bold tabular-nums text-[#003D9E]">
                      {formatMoney(receipt.amount, receipt.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 text-sm">
                    <span className="text-slate-600">Total Paid</span>
                    <span className="font-semibold tabular-nums">{formatMoney(receipt.totalPaid, receipt.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="font-semibold text-slate-700">Balance Due</span>
                    <span className={`text-lg font-bold tabular-nums ${receipt.balance > 0 ? "text-[#EC4724]" : "text-emerald-700"}`}>
                      {formatMoney(receipt.balance, receipt.currency)}
                    </span>
                  </div>
                </section>

                <section className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment Status</span>
                  <Badge variant="outline" className={`rounded-full px-4 py-1 font-bold ${statusClass(receipt.status)}`}>
                    {receipt.status}
                  </Badge>
                </section>

                {receipt.note && (
                  <section className="rounded-lg bg-blue-50/70 px-4 py-3 text-sm">
                    <span className="font-semibold text-[#003D9E]">Note:</span> {receipt.note}
                  </section>
                )}
              </div>

              <footer className="border-t border-slate-200 bg-slate-50 px-6 py-5 text-center sm:px-8">
                <p className="font-semibold text-[#003D9E]">Thank you for your payment.</p>
                <p className="mt-1 text-sm font-medium">{receipt.institute.name}</p>
                {contactLine && <p className="mt-1 text-xs text-slate-500">{contactLine}</p>}
                <p className="mt-3 text-[11px] text-slate-400">This receipt is system generated and requires no signature.</p>
              </footer>
            </article>

            <div data-receipt-actions className="mx-auto flex w-full max-w-[590px] flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={printReceipt} className="gap-2 rounded-full bg-white">
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button onClick={() => void downloadPdf()} disabled={downloading} className="gap-2 rounded-full px-5">
                {downloading ? <Spinner /> : <Download className="h-4 w-4" />}
                {downloading ? "Preparing PDF..." : "Download PDF"}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
