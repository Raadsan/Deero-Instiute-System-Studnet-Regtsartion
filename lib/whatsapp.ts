export type WhatsAppProvider = "meta"

export type WhatsAppSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string; status?: number }

function normalizeToDigits(phone: string) {
  const digits = phone.replace(/[^\d]/g, "")
  return digits
}

export function normalizeWhatsAppTo(phone: string): string | null {
  const digits = normalizeToDigits(phone)
  if (digits.length < 8 || digits.length > 15) return null
  return digits
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
  const provider: WhatsAppProvider = (process.env.WHATSAPP_PROVIDER as WhatsAppProvider | undefined) ?? "meta"
  if (provider !== "meta") return { ok: false, error: `Unsupported provider: ${provider}` }

  const normalizedTo = normalizeWhatsAppTo(to)
  if (!normalizedTo) return { ok: false, error: "Invalid phone number" }

  const token = requireEnv("WHATSAPP_TOKEN")
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID")
  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v20.0"

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedTo,
        type: "text",
        text: { body },
      }),
    })

    const text = await res.text()
    if (!res.ok) {
      return { ok: false, error: text || "WhatsApp API error", status: res.status }
    }

    let messageId: string | undefined
    try {
      const json = JSON.parse(text) as any
      messageId = json?.messages?.[0]?.id
    } catch {
      messageId = undefined
    }

    return { ok: true, messageId }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" }
  }
}

