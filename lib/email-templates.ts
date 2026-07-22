import { DEFAULT_BRAND_NAME } from "@/lib/brand"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />")
}

export function buildBroadcastEmailTemplate(args: {
  subject: string
  message: string
  contextTitle?: string | null
  contextSubtitle?: string | null
  logoCid?: string | null
  logoUrl?: string | null
  brandName?: string | null
}) {
  const brand = args.brandName ?? DEFAULT_BRAND_NAME
  const configuredYear = Number.parseInt(process.env.EMAIL_FOOTER_YEAR ?? "", 10)
  const year = Number.isFinite(configuredYear) ? configuredYear : Math.max(2026, new Date().getFullYear())
  const logoCid = args.logoCid ?? null
  const logoUrl = args.logoUrl ?? null

  const headerTitle = args.contextTitle ? escapeHtml(args.contextTitle) : escapeHtml(args.subject)
  const headerSubtitle = args.contextSubtitle ? escapeHtml(args.contextSubtitle) : ""

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(args.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;background-color:#f6f7fb !important;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;-webkit-text-size-adjust:100%;color-scheme:light;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(args.subject)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f7fb" style="background:#f6f7fb;background-color:#f6f7fb !important;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:640px;background:#ffffff !important;background-color:#ffffff !important;border:1px solid #e6e8ef;border-radius:14px;overflow:hidden;">
            <tr>
              <td bgcolor="#ffffff" style="padding:18px 20px;background:#ffffff !important;background-color:#ffffff !important;border-bottom:1px solid #e6e8ef;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      ${
                        logoUrl
                          ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brand)}" height="42" style="display:block;max-height:42px;width:auto;" />`
                          : logoCid
                            ? `<img src="cid:${logoCid}" alt="${escapeHtml(brand)}" height="42" style="display:block;max-height:42px;width:auto;" />`
                          : `<div style="font-weight:700;font-size:18px;line-height:1;color:#0f172a !important;">${escapeHtml(brand)}</div>`
                      }
                    </td>
                    <td align="right" style="vertical-align:middle;font-size:12px;color:#64748b !important;">
                      ${escapeHtml(new Date().toLocaleDateString())}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td bgcolor="#ffffff" style="padding:22px 20px 8px 20px;background:#ffffff !important;background-color:#ffffff !important;">
                <div style="font-size:20px;font-weight:750;color:#0f172a !important;line-height:1.25;margin-bottom:4px;">${headerTitle}</div>
                ${
                  headerSubtitle
                    ? `<div style="margin-top:6px;font-size:13px;color:#475569 !important;line-height:1.5;">${headerSubtitle}</div>`
                    : ""
                }
              </td>
            </tr>

            <tr>
              <td bgcolor="#ffffff" style="padding:4px 20px 20px 20px;background:#ffffff !important;background-color:#ffffff !important;">
                <div style="margin-top:10px;padding:16px 16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc !important;background-color:#f8fafc !important;color:#0f172a !important;font-size:14px;line-height:1.65;">
                  ${nl2br(args.message)}
                </div>
              </td>
            </tr>

            <tr>
              <td bgcolor="#ffffff" style="padding:0 20px 20px 20px;background:#ffffff !important;background-color:#ffffff !important;">
                <div style="font-size:12px;color:#64748b !important;line-height:1.6;">
                  If you have any questions, please reply to this email to contact the ${escapeHtml(brand)} team.
                </div>
              </td>
            </tr>

            <tr>
              <td bgcolor="#fbfcff" style="padding:16px 20px;border-top:1px solid #e6e8ef;background:#fbfcff !important;background-color:#fbfcff !important;">
                <div style="font-size:12px;color:#64748b !important;line-height:1.6;">
                  &copy; ${year} ${escapeHtml(brand)}. All rights reserved.
                </div>
              </td>
            </tr>
          </table>

          <div style="max-width:640px;padding:10px 6px 0 6px;font-size:11px;color:#94a3b8;line-height:1.6;text-align:center;">
            This message was sent by ${escapeHtml(brand)}.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = `${args.contextTitle ? `${args.contextTitle}\n` : ""}${args.contextSubtitle ? `${args.contextSubtitle}\n\n` : ""}${args.message}`
  return { html, text }
}
