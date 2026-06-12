type FieldChange = {
  label: string
  before: string | null
  after: string | null
}

export type SavedEventChangedEmail = {
  eventTitle: string
  eventUrl: string
  changes: FieldChange[]
  isCancelled: boolean
  unsubscribeUrl: string
}

const escapeHtml = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export function renderSavedEventChangedEmail(input: SavedEventChangedEmail): {
  subject: string
  html: string
  text: string
} {
  const safeTitle = escapeHtml(input.eventTitle)
  const subject = input.isCancelled
    ? `Cancelled: ${input.eventTitle}`
    : `Update on a saved event: ${input.eventTitle}`

  const headline = input.isCancelled
    ? 'A saved event was cancelled'
    : 'A saved event has changed'

  const intro = input.isCancelled
    ? `The organiser cancelled <strong style="color:#ffffff;">${safeTitle}</strong>. We thought you'd want to know — you had it saved.`
    : `Some details have changed for <strong style="color:#ffffff;">${safeTitle}</strong>. Here's what's different:`

  const rows = input.changes
    .map((change) => {
      const before = change.before ? escapeHtml(change.before) : '—'
      const after = change.after ? escapeHtml(change.after) : '—'
      return `
        <tr>
          <td style="padding:10px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px 0 0 12px;font-size:12px;color:rgba(255,255,255,0.55);width:30%;">${escapeHtml(change.label)}</td>
          <td style="padding:10px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-left:0;border-radius:0 12px 12px 0;font-size:13px;color:#ffffff;">
            <span style="color:rgba(255,255,255,0.45);text-decoration:line-through;">${before}</span>
            <span style="color:rgba(255,255,255,0.45);margin:0 6px;">→</span>
            <span style="font-weight:600;">${after}</span>
          </td>
        </tr>
        <tr><td colspan="2" style="height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>
      `
    })
    .join('')

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:48px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0a0a0b;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:40px 32px;">
        <tr><td>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:#ffffff;letter-spacing:-0.5px;">AlbaGo</div>
          <h1 style="margin:32px 0 8px;font-size:24px;line-height:1.25;color:#ffffff;font-weight:700;">${headline}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.65);">${intro}</p>
          ${input.isCancelled ? '' : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 28px;">${rows}</table>`}
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:14px;background:#ee1c25;">
            <a href="${input.eventUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${input.isCancelled ? 'View event details' : 'View updated event'} →</a>
          </td></tr></table>
          <hr style="margin:32px 0;border:0;border-top:1px solid rgba(255,255,255,0.08);">
          <p style="margin:0;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.35);">
            You're getting this because you saved this event on AlbaGo.<br>
            <a href="${input.unsubscribeUrl}" style="color:rgba(255,255,255,0.55);">Manage notifications</a> · AlbaGo
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const textChanges = input.isCancelled
    ? ''
    : input.changes
        .map((c) => `  ${c.label}: ${c.before ?? '—'} → ${c.after ?? '—'}`)
        .join('\n')

  const text = [
    headline,
    '',
    input.isCancelled
      ? `The organiser cancelled "${input.eventTitle}".`
      : `Some details have changed for "${input.eventTitle}":`,
    textChanges,
    '',
    `View it: ${input.eventUrl}`,
    `Manage notifications: ${input.unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, html, text }
}
