export type HormuudSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string; responseCode?: string }

type TokenCache = { token: string; expiresAt: number }

let cachedToken: TokenCache | null = null

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/** Normalize to Hormuud format e.g. 619054660 */
export function normalizeSmsMobile(phone: string): string | null {
  let digits = phone.replace(/[^\d]/g, "")
  if (digits.startsWith("252")) digits = digits.slice(3)
  if (digits.startsWith("0")) digits = digits.slice(1)

  if (digits.length === 9 && digits.startsWith("6")) return digits

  if (digits.length > 9) {
    const last9 = digits.slice(-9)
    if (last9.startsWith("6")) return last9
  }

  return null
}

async function getHormuudToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const username = requireEnv("SMS_HORMUUD_USERNAME")
  const password = requireEnv("SMS_HORMUUD_PASSWORD")

  const body = new URLSearchParams({
    grant_type: "password",
    username,
    password,
  })

  const res = await fetch("https://smsapi.hormuud.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Failed to get Hormuud token: ${text || res.statusText}`)
  }

  let json: { access_token?: string; expires_in?: number }
  try {
    json = JSON.parse(text) as { access_token?: string; expires_in?: number }
  } catch {
    throw new Error("Invalid token response from Hormuud")
  }

  if (!json.access_token) {
    throw new Error("Hormuud token response missing access_token")
  }

  const expiresInMs = (json.expires_in ?? 3600) * 1000
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + expiresInMs - 60_000,
  }

  return cachedToken.token
}

function isHormuudSuccess(json: Record<string, unknown>): boolean {
  const code = String(json.ResponseCode ?? "")
  const message = String(json.ResponseMessage ?? "").toLowerCase()
  const description = String((json.Data as Record<string, unknown> | undefined)?.Description ?? "").toLowerCase()

  if (message.includes("fail") || description.includes("fail") || description.includes("zero balance")) {
    return false
  }

  return code === "200" || code === "201" || message.includes("success")
}

export async function sendHormuudSms(mobile: string, message: string): Promise<HormuudSendResult> {
  const normalized = normalizeSmsMobile(mobile)
  if (!normalized) return { ok: false, error: "Invalid phone number" }

  let token: string
  try {
    token = await getHormuudToken()
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to authenticate with Hormuud" }
  }

  const payload: Record<string, string> = {
    mobile: normalized,
    message,
  }

  const senderId = process.env.SMS_HORMUUD_SENDER_ID?.trim()
  if (senderId) payload.senderid = senderId

  try {
    const res = await fetch("https://smsapi.hormuud.com/api/SendSMS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const text = await res.text()
    let json: Record<string, unknown> = {}
    try {
      json = JSON.parse(text) as Record<string, unknown>
    } catch {
      if (!res.ok) return { ok: false, error: text || "Hormuud SMS API error" }
      return { ok: true }
    }

    if (isHormuudSuccess(json)) {
      const data = json.Data as Record<string, unknown> | undefined
      const messageId = data?.MessageID
      return {
        ok: true,
        messageId: messageId && messageId !== "null" ? String(messageId) : undefined,
      }
    }

    const data = json.Data as Record<string, unknown> | undefined
    const error =
      (typeof data?.Description === "string" && data.Description) ||
      (typeof json.ResponseMessage === "string" && json.ResponseMessage) ||
      text ||
      "Hormuud SMS send failed"

    return {
      ok: false,
      error,
      responseCode: typeof json.ResponseCode === "string" ? json.ResponseCode : undefined,
    }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" }
  }
}
