import { readFile } from "node:fs/promises"
import path from "node:path"

import { getBrandName } from "@/lib/brand"
import { prisma } from "@/lib/prisma"

export type PaymentReceiptStatus = "PAID" | "PARTIAL" | "UNPAID"

export type PaymentReceiptData = {
  paymentId: string
  receiptNo: string
  paidAt: string
  amount: number
  currency: string
  note: string | null
  feeAmount: number
  totalPaid: number
  balance: number
  status: PaymentReceiptStatus
  student: {
    id: string
    studentCode: string | null
    name: string
    phone: string | null
    email: string | null
    className: string | null
  }
  recordedBy: { id: string; name: string } | null
  institute: {
    name: string
    phone: string | null
    website: string
    email: string | null
    address: string | null
    logoUrl: string
  }
}

export function formatPaymentReceiptNumber(value: number) {
  return `REC-${String(value).padStart(4, "0")}`
}

function extractEmail(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.match(/<([^>]+)>/)?.[1]?.trim() || trimmed
}

function instituteDetails() {
  const configuredEmail =
    process.env.INSTITUTE_EMAIL?.trim() ||
    process.env.EMAIL_REPLY_TO?.trim() ||
    extractEmail(process.env.EMAIL_FROM)

  return {
    name: getBrandName(),
    phone: process.env.INSTITUTE_PHONE?.trim() || null,
    website: process.env.INSTITUTE_WEBSITE?.trim() || "deeroinstitute.com",
    email: configuredEmail?.toLowerCase().endsWith("@example.com") ? null : configuredEmail,
    address: process.env.INSTITUTE_ADDRESS?.trim() || null,
    logoUrl: "/images/logo dero isntiute-01.png",
  }
}

export async function getPaymentReceipt(paymentId: string): Promise<PaymentReceiptData | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      receiptNumber: true,
      amount: true,
      currency: true,
      paidAt: true,
      note: true,
      feeAmountSnapshot: true,
      totalPaidSnapshot: true,
      balanceSnapshot: true,
      statusSnapshot: true,
      recordedBy: { select: { id: true, name: true } },
      student: {
        select: {
          id: true,
          studentCode: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          class: { select: { name: true } },
        },
      },
    },
  })

  if (!payment) return null

  return {
    paymentId: payment.id,
    receiptNo: formatPaymentReceiptNumber(payment.receiptNumber),
    paidAt: payment.paidAt.toISOString(),
    amount: Number(payment.amount),
    currency: payment.currency || "USD",
    note: payment.note ?? null,
    feeAmount: Number(payment.feeAmountSnapshot),
    totalPaid: Number(payment.totalPaidSnapshot),
    balance: Number(payment.balanceSnapshot),
    status: payment.statusSnapshot,
    student: {
      id: payment.student.id,
      studentCode: payment.student.studentCode ?? null,
      name: `${payment.student.firstName} ${payment.student.lastName}`.trim(),
      phone: payment.student.phone ?? null,
      email: payment.student.email ?? null,
      className: payment.student.class?.name ?? null,
    },
    recordedBy: payment.recordedBy ?? null,
    institute: instituteDetails(),
  }
}

function safePdfText(value: string | null | undefined) {
  return (value || "—")
    .replace(/[–—]/g, "-")
    .replace(/[•·]/g, "|")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
}

function formatReceiptDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(new Date(value))
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export async function buildPaymentReceiptPdf(receipt: PaymentReceiptData) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
  const document = await PDFDocument.create()
  const page = document.addPage([420, 595])
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const blue = rgb(0 / 255, 61 / 255, 158 / 255)
  const orange = rgb(236 / 255, 71 / 255, 36 / 255)
  const ink = rgb(15 / 255, 23 / 255, 42 / 255)
  const muted = rgb(100 / 255, 116 / 255, 139 / 255)
  const line = rgb(226 / 255, 232 / 255, 240 / 255)
  const pale = rgb(248 / 255, 250 / 255, 252 / 255)
  const width = page.getWidth()
  const margin = 34
  const right = width - margin

  document.setTitle(`${receipt.receiptNo} - ${receipt.student.name}`)
  document.setAuthor(receipt.institute.name)
  document.setSubject("Student payment receipt")

  page.drawRectangle({ x: 0, y: 505, width, height: 90, color: blue })
  page.drawRectangle({ x: 0, y: 501, width, height: 4, color: orange })

  try {
    const logoBytes = await readFile(path.join(process.cwd(), "public", "images", "logo dero isntiute-01.png"))
    const logo = await document.embedPng(logoBytes)
    const logoSize = logo.scale(0.18)
    page.drawRectangle({ x: margin - 6, y: 527, width: 116, height: 45, color: rgb(1, 1, 1), opacity: 0.96 })
    page.drawImage(logo, { x: margin, y: 532, width: Math.min(104, logoSize.width), height: Math.min(35, logoSize.height) })
  } catch {
    page.drawText(safePdfText(receipt.institute.name.toUpperCase()), {
      x: margin,
      y: 546,
      size: 13,
      font: bold,
      color: rgb(1, 1, 1),
    })
  }

  page.drawText("PAYMENT RECEIPT", { x: 238, y: 549, size: 14, font: bold, color: rgb(1, 1, 1) })
  page.drawText("Official student fee record", { x: 238, y: 532, size: 8.5, font: regular, color: rgb(0.86, 0.9, 1) })

  const drawRight = (value: string, y: number, size = 10, font = regular, color = ink) => {
    const text = safePdfText(value)
    page.drawText(text, { x: right - font.widthOfTextAtSize(text, size), y, size, font, color })
  }

  page.drawText("Receipt No", { x: margin, y: 475, size: 8, font: regular, color: muted })
  page.drawText(receipt.receiptNo, { x: margin, y: 459, size: 12, font: bold, color: ink })
  page.drawText("Payment Date", { x: 258, y: 475, size: 8, font: regular, color: muted })
  drawRight(formatReceiptDate(receipt.paidAt), 459, 11, bold)

  page.drawRectangle({ x: margin, y: 377, width: width - margin * 2, height: 58, color: pale, borderColor: line, borderWidth: 1 })
  page.drawText("RECEIVED FROM", { x: margin + 14, y: 415, size: 7.5, font: bold, color: blue })
  page.drawText(safePdfText(receipt.student.name), { x: margin + 14, y: 395, size: 13, font: bold, color: ink })
  const studentMeta = [receipt.student.studentCode, receipt.student.className].filter(Boolean).join("  |  ")
  page.drawText(safePdfText(studentMeta || "No class assigned"), { x: margin + 14, y: 382, size: 8.5, font: regular, color: muted })

  let y = 345
  const drawAmountRow = (label: string, value: string, strong = false, valueColor = ink) => {
    page.drawText(label, { x: margin + 8, y, size: 10, font: strong ? bold : regular, color: strong ? ink : muted })
    drawRight(value, y, strong ? 11 : 10, strong ? bold : regular, valueColor)
    page.drawLine({ start: { x: margin + 8, y: y - 11 }, end: { x: right, y: y - 11 }, thickness: 0.7, color: line })
    y -= 35
  }

  drawAmountRow("Total Fee", formatMoney(receipt.feeAmount, receipt.currency))
  drawAmountRow("Paid This Time", formatMoney(receipt.amount, receipt.currency), true, blue)
  drawAmountRow("Total Paid", formatMoney(receipt.totalPaid, receipt.currency))
  drawAmountRow("Balance Due", formatMoney(receipt.balance, receipt.currency), true, receipt.balance > 0 ? orange : rgb(5 / 255, 150 / 255, 105 / 255))

  const statusColor = receipt.status === "PAID" ? rgb(5 / 255, 150 / 255, 105 / 255) : receipt.status === "PARTIAL" ? blue : orange
  page.drawText("PAYMENT STATUS", { x: margin + 8, y: 198, size: 8, font: bold, color: muted })
  page.drawRectangle({ x: right - 82, y: 188, width: 82, height: 23, color: statusColor, opacity: 0.12, borderColor: statusColor, borderWidth: 0.8 })
  const statusText = receipt.status
  page.drawText(statusText, {
    x: right - 41 - bold.widthOfTextAtSize(statusText, 9) / 2,
    y: 196,
    size: 9,
    font: bold,
    color: statusColor,
  })

  if (receipt.note) {
    page.drawText("Note", { x: margin + 8, y: 166, size: 8, font: bold, color: muted })
    page.drawText(safePdfText(receipt.note).slice(0, 78), { x: margin + 8, y: 151, size: 9, font: regular, color: ink })
  }

  page.drawRectangle({ x: 0, y: 0, width, height: 105, color: pale })
  page.drawLine({ start: { x: margin, y: 105 }, end: { x: right, y: 105 }, thickness: 1, color: line })
  page.drawText("Thank you for your payment.", { x: margin, y: 79, size: 11, font: bold, color: blue })
  const contact = [receipt.institute.phone, receipt.institute.website, receipt.institute.email, receipt.institute.address]
    .filter(Boolean)
    .join("  |  ")
  page.drawText(safePdfText(contact || receipt.institute.name), { x: margin, y: 59, size: 8.5, font: regular, color: muted })
  page.drawText("This receipt is system generated and requires no signature.", { x: margin, y: 39, size: 7.5, font: regular, color: muted })

  return document.save()
}
