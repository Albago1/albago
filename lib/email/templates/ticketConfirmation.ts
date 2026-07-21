export type TicketConfirmationEmail = {
  eventTitle: string
  /** "FRI 11 JUL 2026 · 21:00" — flame kicker, time prominent. */
  kicker: string
  venueLine: string
  serials: string[]
  eventUrl: string
  myTicketsUrl: string
}

const escapeHtml = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export function renderTicketConfirmationEmail(input: TicketConfirmationEmail): {
  subject: string
  html: string
  text: string
} {
  const count = input.serials.length
  const safeTitle = escapeHtml(input.eventTitle)
  const subject = `Your ticket${count > 1 ? 's' : ''} — ${input.eventTitle} · ${input.kicker}`

  const serialChips = input.serials
    .map(
      (serial) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:6px 12px;border:1px solid rgba(255,255,255,0.14);border-radius:999px;font-family:'Courier New',monospace;font-size:12px;color:rgba(255,255,255,0.85);">${escapeHtml(serial)}</span>`,
    )
    .join('')

  const html = `
  <div style="background:#08080c;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;">
      <p style="margin:0 0 24px;font-size:18px;font-weight:800;letter-spacing:0.08em;color:#ffffff;">ALBA<span style="color:#ee1c25;">GO</span></p>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.09);border-radius:20px;padding:28px;">
        <h1 style="margin:0;font-size:24px;line-height:1.15;color:#ffffff;">You're going! 🎟️</h1>
        <p style="margin:14px 0 0;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#ee1c25;">${escapeHtml(input.kicker)}</p>
        <p style="margin:6px 0 0;font-size:19px;font-weight:700;color:#ffffff;">${safeTitle}</p>
        <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">${escapeHtml(input.venueLine)}</p>
        <div style="margin:20px 0 0;">${serialChips}</div>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:rgba(255,255,255,0.65);">
          Your ticket PDF with the QR code is attached — save it or just open
          <strong style="color:#ffffff;">My Tickets</strong> at the door. The calendar invite is attached too.
        </p>
        <a href="${input.myTicketsUrl}" style="display:inline-block;margin-top:22px;padding:12px 22px;background:#ee1c25;border-radius:999px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Open My Tickets</a>
      </div>
      <p style="margin:20px 0 0;font-size:11px;line-height:1.5;color:rgba(255,255,255,0.35);">
        Each ticket admits one person — the first scan at the door wins.
        Event page: <a href="${input.eventUrl}" style="color:rgba(255,255,255,0.55);">${input.eventUrl.replace(/^https?:\/\/(www\.)?/, '')}</a>
      </p>
    </div>
  </div>`

  const text = [
    `You're going!`,
    ``,
    input.kicker,
    input.eventTitle,
    input.venueLine,
    ``,
    `Ticket${count > 1 ? 's' : ''}: ${input.serials.join(', ')}`,
    ``,
    `Your ticket PDF with the QR code is attached. Show it (or My Tickets) at the door.`,
    `My Tickets: ${input.myTicketsUrl}`,
    `Event: ${input.eventUrl}`,
    ``,
    `Each ticket admits one person — the first scan at the door wins.`,
  ].join('\n')

  return { subject, html, text }
}
