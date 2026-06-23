export type EventPublishedEmail = {
  recipientName?: string | null
  eventTitle: string
  eventUrl: string
  cityLabel?: string | null
  dateLabel?: string | null
  manageUrl?: string | null
}

const escapeHtml = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export function renderEventPublishedEmail(input: EventPublishedEmail): {
  subject: string
  html: string
  text: string
} {
  const safeTitle = escapeHtml(input.eventTitle)
  const subject = `Your event is live on AlbaGo: ${input.eventTitle}`

  const greeting = input.recipientName
    ? `Hi ${escapeHtml(input.recipientName)},`
    : 'Hi,'

  const metaBits: string[] = []
  if (input.dateLabel) metaBits.push(escapeHtml(input.dateLabel))
  if (input.cityLabel) metaBits.push(escapeHtml(input.cityLabel))
  const metaLine = metaBits.join(' · ')

  const manageLine = input.manageUrl
    ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.55);">Need to edit something? <a href="${input.manageUrl}" style="color:#ff8a8a;">Manage your event</a>.</p>`
    : ''

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:48px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0a0a0b;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:40px 32px;">
        <tr><td>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:#ffffff;letter-spacing:-0.5px;">AlbaGo</div>
          <div style="margin:24px 0 8px;display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(238,28,37,0.15);color:#ff8a8a;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Approved &amp; live</div>
          <h1 style="margin:8px 0;font-size:26px;line-height:1.2;color:#ffffff;font-weight:700;letter-spacing:-0.3px;">${safeTitle}</h1>
          ${metaLine ? `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.55);">${metaLine}</p>` : '<div style="height:8px;"></div>'}
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.75);">${greeting} good news — your event is published and discoverable on AlbaGo. People can now find it on the map, in search, and on the events page.</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:14px;background:#ee1c25;">
            <a href="${input.eventUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View your event →</a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.55);">Share the link with your community to drive attendance.</p>
          ${manageLine}
          <hr style="margin:32px 0;border:0;border-top:1px solid rgba(255,255,255,0.08);">
          <p style="margin:0;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.35);">
            You're getting this because an admin reviewed your AlbaGo event submission.<br>
            AlbaGo · <a href="https://albago.org" style="color:rgba(255,255,255,0.55);">albago.org</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const textLines = [
    `Your event is live on AlbaGo: ${input.eventTitle}`,
    metaLine,
    '',
    `${greeting.replace(/<[^>]+>/g, '')} good news — your event is published and discoverable on AlbaGo.`,
    '',
    `View your event: ${input.eventUrl}`,
  ]
  if (input.manageUrl) {
    textLines.push('', `Manage your event: ${input.manageUrl}`)
  }
  textLines.push('', '— AlbaGo · https://albago.org')

  const text = textLines.filter(Boolean).join('\n')

  return { subject, html, text }
}
