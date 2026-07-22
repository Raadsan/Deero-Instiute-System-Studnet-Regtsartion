import { NextResponse } from "next/server"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import { getAuditLog, getAuditTypeLabel, type AuditEntryType } from "@/lib/audit-service"
import { buildBrandedPdfDocument, buildStructuredCsv, formatExportDate } from "@/lib/document-export"
import { formatMoney } from "@/lib/finance-utils"

function parseType(value: string | null): AuditEntryType | "ALL" | null {
  if (!value || value === "ALL") return "ALL"
  const allowed: AuditEntryType[] = [
    "STUDENT_PAYMENT",
    "PARTNER_PAYOUT",
    "TEACHER_PAYOUT",
    "STAFF_PAYOUT",
    "FINANCE_INCOME",
    "FINANCE_EXPENSE",
  ]
  return allowed.includes(value as AuditEntryType) ? (value as AuditEntryType) : null
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const { searchParams } = new URL(req.url)
    const format = searchParams.get("format") ?? "excel"
    const typeParam = searchParams.get("type")
    const type = parseType(typeParam)
    if (typeParam && type === null) {
      return NextResponse.json({ message: "Invalid type filter" }, { status: 400 })
    }

    const result = await getAuditLog({ page: 1, pageSize: 500, type: type ?? "ALL" })
    const entries = result.entries
    const stamp = new Date().toISOString().slice(0, 10)

    if (format === "pdf") {
      const bytes = await buildBrandedPdfDocument({
        title: "Audit Log",
        subtitle: `Payment & payout activity${type && type !== "ALL" ? ` · ${getAuditTypeLabel(type)}` : ""}`,
        summary: [
          { label: "Total entries", value: String(entries.length), highlight: true },
          { label: "Generated", value: formatExportDate(new Date()) },
        ],
        columns: [
          { header: "Date", width: 78 },
          { header: "Type", width: 88 },
          { header: "Description", width: 110 },
          { header: "Amount", width: 72, align: "right" },
          { header: "Recorded By", width: 100 },
        ],
        rows: entries.map((entry) => [
          formatExportDate(entry.occurredAt),
          getAuditTypeLabel(entry.type),
          entry.description,
          formatMoney(entry.amount, entry.currency),
          entry.recordedBy?.name ?? "Unknown",
        ]),
      })

      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="audit-log-${stamp}.pdf"`,
          "Cache-Control": "no-store",
        },
      })
    }

    const csv = buildStructuredCsv([
      {
        rows: [["Audit Log"], ["Generated", formatExportDate(new Date())], ["Entries", String(entries.length)]],
      },
      {
        title: "Records",
        rows: [
          ["Date", "Type", "Description", "Amount", "Currency", "Note", "Recorded By", "Recorded Email"],
          ...entries.map((entry) => [
            formatExportDate(entry.occurredAt),
            getAuditTypeLabel(entry.type),
            entry.description,
            String(entry.amount),
            entry.currency,
            entry.note ?? "",
            entry.recordedBy?.name ?? "Unknown",
            entry.recordedBy?.email ?? "",
          ]),
        ],
      },
    ])

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[api/audit/export]", error)
    const message = error instanceof Error ? error.message : "Export failed"
    return NextResponse.json({ message }, { status: 500 })
  }
}
