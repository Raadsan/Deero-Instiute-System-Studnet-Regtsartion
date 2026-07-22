import { getBrandName } from "@/lib/brand"

export type ExportSummaryItem = { label: string; value: string; highlight?: boolean }

export type ExportTableColumn = {
  header: string
  width: number
  align?: "left" | "right"
}

export type ExportTableRow = string[]

function truncateText(text: string, maxLen: number) {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (cleaned.length <= maxLen) return cleaned
  return `${cleaned.slice(0, Math.max(0, maxLen - 1))}…`
}

export async function buildBrandedPdfDocument(args: {
  title: string
  subtitle?: string
  summary: ExportSummaryItem[]
  columns: ExportTableColumn[]
  rows: ExportTableRow[]
  emptyMessage?: string
}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const brand = getBrandName()

  const pageWidth = 595
  const pageHeight = 842
  const margin = 42
  const contentWidth = pageWidth - margin * 2
  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin
  let tableSection = false

  const brandColor = rgb(32 / 255, 96 / 255, 172 / 255)
  const mutedColor = rgb(0.45, 0.45, 0.45)
  const lineColor = rgb(0.88, 0.88, 0.88)
  const incomeColor = rgb(0.05, 0.55, 0.35)
  const expenseColor = rgb(0.75, 0.15, 0.15)

  const drawTableHeader = () => {
    page.drawRectangle({ x: margin, y: y - 14, width: contentWidth, height: 22, color: rgb(0.96, 0.97, 0.99) })
    let x = margin + 6
    for (const col of args.columns) {
      page.drawText(col.header, {
        x: col.align === "right" ? x + col.width - 4 : x,
        y: y - 2,
        size: 9,
        font: bold,
        color: rgb(0.2, 0.2, 0.2),
      })
      x += col.width
    }
    y -= 24
  }

  const startTablePage = () => {
    page = doc.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
    drawTableHeader()
  }

  const ensureSpace = (height: number) => {
    if (y - height < 52) {
      if (tableSection) startTablePage()
      else {
        page = doc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }
    }
  }

  page.drawRectangle({ x: 0, y: pageHeight - 72, width: pageWidth, height: 72, color: brandColor })
  page.drawText(brand.toUpperCase(), {
    x: margin,
    y: pageHeight - 38,
    size: 11,
    font: bold,
    color: rgb(1, 1, 1),
  })
  page.drawText(args.title, {
    x: margin,
    y: pageHeight - 58,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  })
  y = pageHeight - 92

  if (args.subtitle) {
    page.drawText(args.subtitle, { x: margin, y, size: 10, font: regular, color: mutedColor })
    y -= 22
  }

  ensureSpace(24 + args.summary.length * 18)
  page.drawText("Summary", { x: margin, y, size: 12, font: bold, color: rgb(0.12, 0.12, 0.12) })
  y -= 18

  for (const item of args.summary) {
    ensureSpace(16)
    page.drawText(item.label, { x: margin, y, size: 10, font: regular, color: mutedColor })
    page.drawText(item.value, {
      x: margin + 190,
      y,
      size: item.highlight ? 11 : 10,
      font: item.highlight ? bold : regular,
      color: rgb(0.1, 0.1, 0.1),
    })
    y -= 16
  }

  y -= 8
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: lineColor })
  y -= 20

  tableSection = true
  drawTableHeader()

  if (!args.rows.length) {
    ensureSpace(20)
    page.drawText(args.emptyMessage ?? "No records found.", {
      x: margin,
      y,
      size: 10,
      font: regular,
      color: mutedColor,
    })
  } else {
    args.rows.forEach((row, index) => {
      ensureSpace(18)
      if (index > 0 && index % 2 === 0) {
        page.drawRectangle({ x: margin, y: y - 12, width: contentWidth, height: 16, color: rgb(0.985, 0.985, 0.99) })
      }

      let x = margin + 6
      row.forEach((cell, cellIndex) => {
        const col = args.columns[cellIndex]
        if (!col) return
        const maxChars = Math.floor(col.width / 5.5)
        const text = truncateText(cell, maxChars)
        const lower = cell.toLowerCase()
        page.drawText(text, {
          x: col.align === "right" ? x + col.width - 6 : x,
          y,
          size: 9,
          font: regular,
          color: lower === "income" ? incomeColor : lower === "expense" ? expenseColor : rgb(0.15, 0.15, 0.15),
        })
        x += col.width
      })
      y -= 16
    })
  }

  const generatedAt = new Date().toLocaleString()
  const totalPages = doc.getPageCount()
  for (let i = 0; i < totalPages; i++) {
    const current = doc.getPage(i)
    current.drawText(`Generated ${generatedAt} · Page ${i + 1} of ${totalPages}`, {
      x: margin,
      y: 28,
      size: 8,
      font: regular,
      color: mutedColor,
    })
  }

  return doc.save()
}

export function buildStructuredCsv(sections: Array<{ title?: string; rows: string[][] }>) {
  const lines: string[] = []
  for (const section of sections) {
    if (section.title) lines.push(section.title)
    for (const row of section.rows) {
      lines.push(row.map(csvEscape).join(","))
    }
    lines.push("")
  }
  return `\uFEFF${lines.join("\n")}`
}

export function csvEscape(value: unknown) {
  const str = value === null || value === undefined ? "" : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function csvRow(...values: unknown[]) {
  return values.map(csvEscape).join(",")
}

export function formatExportDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
