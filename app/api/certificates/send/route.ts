
import { NextResponse } from "next/server"
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { enqueueAndSendEmailMessage } from "@/lib/email-queue"
import { buildBroadcastEmailTemplate } from "@/lib/email-templates"
import { getBrandName } from "@/lib/brand"

export const runtime = "nodejs"

type NameConfig = {
  x: number
  y: number
  size: number
  color: string
  fontFamily: string
  fontWeight: string
  align: "left" | "center" | "right"
  autoFit: boolean
  maxWidth: number
  showBackground: boolean
  backgroundColor: string
  show: boolean
}

type BarcodeConfig = {
  x: number
  y: number
  show: boolean
  showDate: boolean
  showSerial: boolean
}

type TemplateData = {
  mime: string
  buffer: Buffer
}

const DEFAULT_NAME_CONFIG: NameConfig = {
  x: 50,
  y: 50,
  size: 40,
  color: "#ea580c",
  fontFamily: "serif",
  fontWeight: "bold",
  align: "center",
  autoFit: true,
  maxWidth: 70,
  showBackground: true,
  backgroundColor: "#ffffff",
  show: true,
}

const DEFAULT_BARCODE_CONFIG: BarcodeConfig = {
  x: 50,
  y: 85,
  show: true,
  showDate: true,
  showSerial: true,
}

type ContentConfig = {
  x: number
}

type PdfLayout = "standard" | "mobile"

const DEFAULT_CONTENT_CONFIG: ContentConfig = {
  x: 50,
}

const NAME_PADDING_X = 16
const NAME_PADDING_Y = 4
const MIN_NAME_WIDTH = 300

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim().toLowerCase().replace(/^#/, "")
  if (/^[0-9a-f]{3}$/.test(trimmed)) {
    const expanded = trimmed
      .split("")
      .map((c) => `${c}${c}`)
      .join("")
    return `#${expanded}`
  }
  if (/^[0-9a-f]{6}$/.test(trimmed)) return `#${trimmed}`
  return fallback
}

function hexToRgb255(hex: string) {
  const normalized = hex.replace(/^#/, "")
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return { r, g, b }
}

function toRgbColor(value: unknown, fallback: string) {
  const safe = normalizeHexColor(value, fallback)
  const { r, g, b } = hexToRgb255(safe)
  return rgb(r / 255, g / 255, b / 255)
}

function parseTemplateData(dataUrl: string): TemplateData | null {
  const match = /^data:(image\/(?:png|jpe?g));base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  const mime = match[1].toLowerCase()
  const buffer = Buffer.from(match[2], "base64")
  return { mime, buffer }
}

function resolveFontFamily(fontFamily: string, bold: boolean) {
  const family = (fontFamily || "").toLowerCase()
  switch (family) {
    case "serif":
      return bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman
    case "sans-serif":
      return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica
    case "monospace":
      return bold ? StandardFonts.CourierBold : StandardFonts.Courier
    case "cursive":
      return bold ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanItalic
    case "fantasy":
      return StandardFonts.HelveticaBold
    default:
      return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica
  }
}

function makeBarcodeBits(value: string, count: number) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  const bits: boolean[] = []
  for (let i = 0; i < count; i += 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0
    bits.push(Boolean(hash & 1))
  }
  return bits
}

function getOrdinalSuffix(day: number) {
  if (day % 100 >= 11 && day % 100 <= 13) return "th"
  switch (day % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}

function formatCertificateDate(date: Date) {
  const day = date.getDate()
  const month = date.toLocaleString("en-US", { month: "long" })
  const year = date.getFullYear()
  return `${day}${getOrdinalSuffix(day)} ${month} ${year}`
}

function normalizeDateText(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return formatCertificateDate(parsed)
  }
  return trimmed
}

function buildSerialPrefix(name?: string | null) {
  if (!name) return "SR"
  const cleaned = name.replace(/[^a-zA-Z0-9 ]+/g, " ").trim()
  if (!cleaned) return "SR"
  const initials = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
  return initials.slice(0, 2) || "SR"
}

function hashToDigits(value: string, length: number) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return String(hash % 10 ** length).padStart(length, "0")
}

function makeSerialText(studentId: string, className?: string | null) {
  const prefix = buildSerialPrefix(className)
  const digits = hashToDigits(studentId, 6)
  return `${prefix}-${digits.slice(0, 2)}-${digits.slice(2)}`
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next
    } else {
      if (line) lines.push(line)
      line = word
    }
  })
  if (line) lines.push(line)
  return lines
}

function alignX(anchorX: number, elementWidth: number, align: "left" | "center" | "right", maxWidth: number) {
  let x = anchorX
  if (align === "center") x = anchorX - elementWidth / 2
  if (align === "right") x = anchorX - elementWidth
  return Math.max(0, Math.min(maxWidth - elementWidth, x))
}

function sanitizeFilename(value: string) {
  const safe = value.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_+|_+$/g, "")
  return safe || "certificate"
}

async function createCertificatePdfBytes(args: {
  template: TemplateData
  studentName: string
  studentId: string
  className: string | null
  nameConfig: NameConfig
  barcodeConfig: BarcodeConfig
  contentConfig: ContentConfig
  contentEnabled: boolean
  dateText: string
  pdfLayout: PdfLayout
}) {
  const pdfDoc = await PDFDocument.create()
  const isPng = args.template.mime.includes("png")
  const image = isPng ? await pdfDoc.embedPng(args.template.buffer) : await pdfDoc.embedJpg(args.template.buffer)
  const baseWidth = image.width
  const baseHeight = image.height
  const isMobile = args.pdfLayout === "mobile"
  const pageWidth = isMobile ? baseHeight : baseWidth
  const pageHeight = isMobile ? baseWidth : baseHeight
  const scale = isMobile ? pageWidth / baseWidth : 1
  const offsetX = (pageWidth - baseWidth * scale) / 2
  const offsetY = (pageHeight - baseHeight * scale) / 2

  const page = pdfDoc.addPage([pageWidth, pageHeight])
  page.drawImage(image, { x: offsetX, y: offsetY, width: baseWidth * scale, height: baseHeight * scale })

  const width = baseWidth
  const height = baseHeight
  const toPageX = (value: number) => offsetX + value * scale
  const toPageY = (value: number) => offsetY + value * scale
  const toPage = (value: number) => value * scale

  const name = args.studentName || "Student"
  let nameFontSize = clampNumber(args.nameConfig.size, 8, 200, DEFAULT_NAME_CONFIG.size)
  const nameIsBold = args.nameConfig.fontWeight === "bold"
  const nameFont = await pdfDoc.embedFont(resolveFontFamily(args.nameConfig.fontFamily, nameIsBold))
  const maxNameWidthPercent = clampNumber(args.nameConfig.maxWidth, 10, 100, DEFAULT_NAME_CONFIG.maxWidth)
  const maxNameWidthPx = width * (maxNameWidthPercent / 100)
  if (args.nameConfig.autoFit) {
    const measured = nameFont.widthOfTextAtSize(name, nameFontSize)
    if (measured > maxNameWidthPx) {
      const scaled = Math.max(10, Math.floor(nameFontSize * (maxNameWidthPx / measured)))
      nameFontSize = scaled
    }
  }
  const nameTextWidth = nameFont.widthOfTextAtSize(name, nameFontSize)
  const nameTextHeight = nameFont.heightAtSize(nameFontSize)
  const nameYTop = height * (1 - clampNumber(args.nameConfig.y, 0, 100, DEFAULT_NAME_CONFIG.y) / 100)
  const nameAnchorX = width * (clampNumber(args.nameConfig.x, 0, 100, DEFAULT_NAME_CONFIG.x) / 100)

  let nameTextY = nameYTop - nameTextHeight
  nameTextY = Math.max(0, Math.min(height - nameTextHeight, nameTextY))
  const nameTextX = alignX(nameAnchorX, nameTextWidth, args.nameConfig.align, width)

  if (args.contentEnabled) {
    const contentFont = await pdfDoc.embedFont(resolveFontFamily("sans-serif", false))
    const contentSize = Math.max(12, Math.min(28, nameFontSize * 0.4))
    const contentGap = contentSize * 0.45
    const contentColor = toRgbColor("#1f2937", "#1f2937")

    const titleLine = "this is to Certify"
    const contentCenterX = width * (clampNumber(args.contentConfig.x, 0, 100, DEFAULT_CONTENT_CONFIG.x) / 100)
    const titleWidth = contentFont.widthOfTextAtSize(titleLine, contentSize)
    let titleX = contentCenterX - titleWidth / 2
    titleX = Math.max(0, Math.min(width - titleWidth, titleX))
    let titleY = nameTextY + nameTextHeight + contentGap
    if (titleY + contentSize > height) titleY = height - contentSize
    page.drawText(titleLine, {
      x: toPageX(titleX),
      y: toPageY(titleY),
      size: toPage(contentSize),
      font: contentFont,
      color: contentColor,
    })

    const courseLabel = args.className ? args.className : "course"
    const bodyText = `Has successfully completed the requirements for the ${courseLabel} course, with all the honors and rights pertaining.`
    const bodyLines = wrapText(bodyText, contentFont, contentSize, width * 0.7)
    const bodyStartY = nameTextY - contentSize * 1.6
    bodyLines.forEach((line, index) => {
      const lineWidth = contentFont.widthOfTextAtSize(line, contentSize)
      let lineX = contentCenterX - lineWidth / 2
      lineX = Math.max(0, Math.min(width - lineWidth, lineX))
      const lineY = bodyStartY - index * (contentSize + contentGap)
      if (lineY < 0) return
      page.drawText(line, {
        x: toPageX(lineX),
        y: toPageY(lineY),
        size: toPage(contentSize),
        font: contentFont,
        color: contentColor,
      })
    })
  }

  if (args.nameConfig.show) {
    if (args.nameConfig.showBackground) {
      const rectWidth = Math.max(MIN_NAME_WIDTH, nameTextWidth + NAME_PADDING_X * 2)
      const rectHeight = nameTextHeight + NAME_PADDING_Y * 2
      const rectX = alignX(nameAnchorX, rectWidth, args.nameConfig.align, width)
      let rectY = nameTextY - NAME_PADDING_Y
      rectY = Math.max(0, Math.min(height - rectHeight, rectY))
      page.drawRectangle({
        x: toPageX(rectX),
        y: toPageY(rectY),
        width: toPage(rectWidth),
        height: toPage(rectHeight),
        color: toRgbColor(args.nameConfig.backgroundColor, DEFAULT_NAME_CONFIG.backgroundColor),
      })
    }

    page.drawText(name, {
      x: toPageX(nameTextX),
      y: toPageY(nameTextY),
      size: toPage(nameFontSize),
      font: nameFont,
      color: toRgbColor(args.nameConfig.color, DEFAULT_NAME_CONFIG.color),
    })
  }

  if (args.barcodeConfig.show) {
    const barcodeFont = await pdfDoc.embedFont(StandardFonts.Courier)
    const dateFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const barWidth = Math.min(width * 0.45, 260)
    const barHeight = Math.max(18, Math.min(36, height * 0.05))
    const barCenterX = width * (clampNumber(args.barcodeConfig.x, 0, 100, DEFAULT_BARCODE_CONFIG.x) / 100)
    let barX = barCenterX - barWidth / 2
    barX = Math.max(0, Math.min(width - barWidth, barX))
    const barTop = height * (1 - clampNumber(args.barcodeConfig.y, 0, 100, DEFAULT_BARCODE_CONFIG.y) / 100)
    let barY = barTop - barHeight
    const dateFontSize = Math.max(10, Math.min(18, nameFontSize * 0.35))
    const serialFontSize = Math.max(8, Math.min(12, nameFontSize * 0.3))
    const topPadding = args.barcodeConfig.showDate && args.dateText ? dateFontSize + 4 : 2
    const bottomPadding = args.barcodeConfig.showSerial ? serialFontSize + 4 : 2
    barY = Math.max(bottomPadding, Math.min(height - barHeight - topPadding, barY))

    const serialText = makeSerialText(args.studentId, args.className)
    const bits = makeBarcodeBits(serialText, 40)
    const segment = barWidth / bits.length
    bits.forEach((bit, index) => {
      const barH = bit ? barHeight : barHeight * 0.6
      const barW = Math.max(1, segment * 0.7)
      const barLeft = barX + index * segment
      const barBottom = barY + (barHeight - barH)
      page.drawRectangle({
        x: toPageX(barLeft),
        y: toPageY(barBottom),
        width: toPage(barW),
        height: toPage(barH),
        color: rgb(0, 0, 0),
      })
    })

    if (args.barcodeConfig.showDate && args.dateText) {
      const dateWidth = dateFont.widthOfTextAtSize(args.dateText, dateFontSize)
      let dateX = barCenterX - dateWidth / 2
      dateX = Math.max(0, Math.min(width - dateWidth, dateX))
      let dateY = barY + barHeight + 4
      if (dateY + dateFontSize > height) dateY = height - dateFontSize
      page.drawText(args.dateText, {
        x: toPageX(dateX),
        y: toPageY(dateY),
        size: toPage(dateFontSize),
        font: dateFont,
        color: toRgbColor(args.nameConfig.color, DEFAULT_NAME_CONFIG.color),
      })
    }

    if (args.barcodeConfig.showSerial) {
      const serialLabel = `SERIAL # : ${serialText}`
      const serialWidth = barcodeFont.widthOfTextAtSize(serialLabel, serialFontSize)
      let serialX = barCenterX - serialWidth / 2
      serialX = Math.max(0, Math.min(width - serialWidth, serialX))
      let serialY = barY - serialFontSize - 2
      if (serialY < 0) serialY = 2
      page.drawText(serialLabel, {
        x: toPageX(serialX),
        y: toPageY(serialY),
        size: toPage(serialFontSize),
        font: barcodeFont,
        color: rgb(0, 0, 0),
      })
    }
  }

  return await pdfDoc.save()
}

function resolveNameConfig(settings: unknown): NameConfig {
  const raw = settings && typeof settings === "object" ? (settings as any).name : null
  const align = raw?.align
  const safeAlign = align === "left" || align === "right" || align === "center" ? align : DEFAULT_NAME_CONFIG.align
  return {
    x: clampNumber(raw?.x, 0, 100, DEFAULT_NAME_CONFIG.x),
    y: clampNumber(raw?.y, 0, 100, DEFAULT_NAME_CONFIG.y),
    size: clampNumber(raw?.size, 8, 200, DEFAULT_NAME_CONFIG.size),
    color: normalizeHexColor(raw?.color, DEFAULT_NAME_CONFIG.color),
    fontFamily: typeof raw?.fontFamily === "string" ? raw.fontFamily : DEFAULT_NAME_CONFIG.fontFamily,
    fontWeight: raw?.fontWeight === "bold" ? "bold" : DEFAULT_NAME_CONFIG.fontWeight,
    align: safeAlign,
    autoFit: raw?.autoFit !== false,
    maxWidth: clampNumber(raw?.maxWidth, 10, 100, DEFAULT_NAME_CONFIG.maxWidth),
    showBackground: raw?.showBackground !== false,
    backgroundColor: normalizeHexColor(raw?.backgroundColor, DEFAULT_NAME_CONFIG.backgroundColor),
    show: raw?.show !== false,
  }
}

function resolveBarcodeConfig(settings: unknown): BarcodeConfig {
  const raw = settings && typeof settings === "object" ? (settings as any).barcode : null
  return {
    x: clampNumber(raw?.x, 0, 100, DEFAULT_BARCODE_CONFIG.x),
    y: clampNumber(raw?.y, 0, 100, DEFAULT_BARCODE_CONFIG.y),
    show: raw?.show !== false,
    showDate: raw?.showDate !== false,
    showSerial: raw?.showSerial !== false,
  }
}

function resolveContentConfig(settings: unknown): ContentConfig {
  const raw = settings && typeof settings === "object" ? (settings as any).content : null
  return {
    x: clampNumber(raw?.x, 0, 100, DEFAULT_CONTENT_CONFIG.x),
  }
}

function resolvePdfLayout(settings: unknown): PdfLayout {
  const raw = settings && typeof settings === "object" ? (settings as any).pdfLayout : null
  return raw === "mobile" ? "mobile" : "standard"
}

function resolveContentEnabled(settings: unknown) {
  const raw = settings && typeof settings === "object" ? (settings as any).contentEnabled : null
  return raw !== false
}

function resolveDateText(settings: unknown) {
  const raw = settings && typeof settings === "object" ? (settings as any).dateText : null
  return normalizeDateText(raw) ?? formatCertificateDate(new Date())
}

export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid body" }, { status: 400 })
  }

  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { classId, template, settings, studentIds } = body as {
    classId?: unknown
    template?: unknown
    settings?: unknown
    studentIds?: unknown
  }

  if (typeof classId !== "string" || !classId.trim()) {
    return NextResponse.json({ message: "classId is required" }, { status: 400 })
  }

  const templateDataUrl =
    typeof template === "string"
      ? template
      : template && typeof template === "object"
        ? (template as any).dataUrl
        : null

  if (typeof templateDataUrl !== "string" || !templateDataUrl.startsWith("data:")) {
    return NextResponse.json({ message: "template dataUrl is required" }, { status: 400 })
  }

  const parsedTemplate = parseTemplateData(templateDataUrl)
  if (!parsedTemplate) {
    return NextResponse.json({ message: "Unsupported template format" }, { status: 400 })
  }

  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } })
  if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 })

  const nameConfig = resolveNameConfig(settings)
  const barcodeConfig = resolveBarcodeConfig(settings)
  const contentConfig = resolveContentConfig(settings)
  const contentEnabled = resolveContentEnabled(settings)
  const dateText = resolveDateText(settings)
  const pdfLayout = resolvePdfLayout(settings)

  const studentWhere: { classId: string; isActive: boolean; id?: { in: string[] } } = {
    classId,
    isActive: true,
  }
  if (Array.isArray(studentIds) && studentIds.length) {
    const ids = studentIds.filter((id): id is string => typeof id === "string")
    if (ids.length) {
      studentWhere.id = { in: ids }
    }
  }

  const students = await prisma.student.findMany({
    where: studentWhere,
    select: { id: true, firstName: true, lastName: true, email: true },
  })

  if (!students.length) return NextResponse.json({ message: "No students found" }, { status: 404 })

  const className = typeof cls.name === "string" ? cls.name : null
  const subject = className ? `Certificate - ${className}` : "Your Certificate"
  const brandName = getBrandName()

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const student of students) {
    const studentId = student.id
    const studentName = `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Student"
    const message = `Hi ${studentName},\n\nAttached is your certificate${className ? ` for ${className}` : ""}.\n\nCongratulations!`
    const template = buildBroadcastEmailTemplate({
      subject,
      message,
      contextSubtitle: className ? `Class: ${className}` : null,
      logoCid: "brandlogo",
      brandName,
    })

    const email = typeof student.email === "string" ? student.email.trim() : ""
    if (!email || !email.includes("@")) {
      const result = await enqueueAndSendEmailMessage({
        to: email || null,
        subject,
        text: template.text,
        html: template.html,
        meta: { kind: "CERTIFICATE", initiatedBy: session.userId, classId, studentId },
      })
      if (result.ok && result.status === "SENT") sent += 1
      else if (result.ok && result.status === "SKIPPED") skipped += 1
      else failed += 1
      continue
    }

    let pdfBytes: Uint8Array
    try {
      pdfBytes = await createCertificatePdfBytes({
        template: parsedTemplate,
        studentName,
        studentId,
        className,
        nameConfig,
        barcodeConfig,
        contentConfig,
        contentEnabled,
        dateText,
        pdfLayout,
      })
    } catch {
      failed += 1
      continue
    }

    const attachments = [
      {
        filename: `${sanitizeFilename(studentName)}_Certificate.pdf`,
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ]

    const result = await enqueueAndSendEmailMessage({
      to: email,
      subject,
      text: template.text,
      html: template.html,
      attachments,
      meta: { kind: "CERTIFICATE", initiatedBy: session.userId, classId, studentId },
    })

    if (result.ok && result.status === "SENT") sent += 1
    else if (result.ok && result.status === "SKIPPED") skipped += 1
    else failed += 1
  }

  return NextResponse.json({
    ok: true,
    classId,
    total: students.length,
    sent,
    skipped,
    failed,
  })
}
