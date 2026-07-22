import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { requireFinanceSession } from "@/lib/finance-auth"
import { mapRecordedBy, recordedBySelect } from "@/lib/recorded-by"

function serverError(error: unknown) {
  console.error("[api/finance/entries]", error)
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ message }, { status: 500 })
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")

    const entries = await prisma.financeEntry.findMany({
      where: type === "INCOME" || type === "EXPENSE" ? { type } : {},
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: { recordedBy: { select: recordedBySelect } },
    })

    return NextResponse.json(
      entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        amount: entry.amount,
        category: entry.category,
        note: entry.note,
        occurredAt: entry.occurredAt.toISOString(),
        recordedBy: mapRecordedBy(entry.recordedBy),
      })),
    )
  } catch (error) {
    return serverError(error)
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequestCookies()
    const auth = requireFinanceSession(session)
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status })

    const body: unknown = await req.json()
    if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

    const { type, title, amount, category, note, occurredAt } = body as {
      type?: unknown
      title?: unknown
      amount?: unknown
      category?: unknown
      note?: unknown
      occurredAt?: unknown
    }

    if (type !== "INCOME" && type !== "EXPENSE") {
      return NextResponse.json({ message: "Type must be INCOME or EXPENSE" }, { status: 400 })
    }
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ message: "Title is required" }, { status: 400 })
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ message: "Valid amount is required" }, { status: 400 })
    }

    const entry = await prisma.financeEntry.create({
      data: {
        type,
        title: title.trim(),
        amount,
        category: typeof category === "string" && category.trim() ? category.trim() : null,
        note: typeof note === "string" && note.trim() ? note.trim() : null,
        occurredAt: typeof occurredAt === "string" && occurredAt ? new Date(occurredAt) : new Date(),
        recordedById: auth.session.userId,
      },
      include: { recordedBy: { select: recordedBySelect } },
    })

    return NextResponse.json(
      {
        id: entry.id,
        type: entry.type,
        title: entry.title,
        amount: entry.amount,
        category: entry.category,
        note: entry.note,
        occurredAt: entry.occurredAt.toISOString(),
        recordedBy: mapRecordedBy(entry.recordedBy),
      },
      { status: 201 },
    )
  } catch (error) {
    return serverError(error)
  }
}
