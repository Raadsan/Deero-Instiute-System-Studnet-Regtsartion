import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { message: "WhatsApp messaging is disabled. Use SMS or Email." },
    { status: 410 },
  )
}
