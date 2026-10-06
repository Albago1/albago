// Seat-sale emails (phase 43): one template, one variant per moment in the
// buyer's journey, plus the seller's "new reservation" ping. Same ink/flame
// shell as the ticket confirmation.

export type SeatEmailKind =
  | 'reserved'
  | 'paid'
  | 'transfer_sent'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'seller_new'

export type SeatEmailData = {
  eventTitle: string
  /** "SAT 28 NOV 2026 · 18:00" */
  kicker: string
  venueLine: string
  reference: string
  buyerName: string
  categoryLabel: string
  quantity: number
  seatsLine: string
  totalLabel: string
  eventimEmail: string
  /** "Mon 9 Nov, 14:00" — only for 'reserved'. */
  holdUntilLabel: string | null
  /** "Sat 21 Nov" — the delivery promise. */
  deliverByLabel: string | null
  sellerName: string | null
  trackerUrl: string
  eventUrl: string
  /** seller_new only */
  adminUrl?: string
  buyerEmail?: string
  phone?: string | null
  note?: string | null
}

const escapeHtml = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

type Copy = { subject: string; heading: string; body: string[]; cta: string }

function copyFor(kind: SeatEmailKind, d: SeatEmailData): Copy {
  const seats = `${d.quantity} seat${d.quantity === 1 ? '' : 's'}`
  switch (kind) {
    case 'reserved':
      return {
        subject: `Seats reserved — ${d.eventTitle} · ${d.reference}`,
        heading: 'Your seats are reserved',
        body: [
          `We're holding ${seats} for you${d.holdUntilLabel ? ` until ${d.holdUntilLabel}` : ''}.`,
          `Next step: payment. We'll send you the payment details by email. Keep your reference ${d.reference} — it identifies your seats.`,
          `Once paid, the tickets are transferred to your Eventim account (${d.eventimEmail})${d.deliverByLabel ? ` by ${d.deliverByLabel}` : ''}.`,
        ],
        cta: 'Track your seats',
      }
    case 'paid':
      return {
        subject: `Payment received — ${d.eventTitle} · ${d.reference}`,
        heading: 'Payment received',
        body: [
          `Thank you — your ${seats} are confirmed.`,
          `We transfer the tickets to your Eventim account (${d.eventimEmail}) as soon as Eventim allows it${d.deliverByLabel ? `, and no later than ${d.deliverByLabel}` : ''}. If we can't deliver, you get a full refund.`,
        ],
        cta: 'Track your seats',
      }
    case 'transfer_sent':
      return {
        subject: `Your tickets are on the way — ${d.eventTitle}`,
        heading: 'Your tickets are on the way',
        body: [
          `We've sent the transfer of your ${seats} to your Eventim account (${d.eventimEmail}).`,
          `Open the Eventim app or eventim.de, accept the transfer, then tap "I got my tickets" on AlbaGo so we know they arrived.`,
        ],
        cta: 'Confirm I got them',
      }
    case 'cancelled':
      return {
        subject: `Reservation cancelled — ${d.reference}`,
        heading: 'Reservation cancelled',
        body: [`Your reservation ${d.reference} was cancelled and the seats went back on sale.`],
        cta: 'See the event',
      }
    case 'expired':
      return {
        subject: `Your hold expired — ${d.reference}`,
        heading: 'Your hold expired',
        body: [`The hold on reservation ${d.reference} ran out before payment, so the seats went back on sale.`],
        cta: 'See the event',
      }
    case 'refunded':
      return {
        subject: `Refund issued — ${d.reference}`,
        heading: 'Refund issued',
        body: [`We've refunded reservation ${d.reference} (${d.totalLabel}). Depending on the payment method it can take a few days to show.`],
        cta: 'Track your seats',
      }
    case 'seller_new':
      return {
        subject: `New seat reservation ${d.reference} — ${seats}, ${d.totalLabel}`,
        heading: 'New reservation',
        body: [
          `${d.buyerName} (${d.buyerEmail ?? ''}) reserved ${seats} in ${d.categoryLabel}.`,
          `Eventim email: ${d.eventimEmail}${d.phone ? ` · Phone: ${d.phone}` : ''}`,
          ...(d.note ? [`Note: ${d.note}`] : []),
        ],
        cta: 'Open the seat console',
      }
  }
}

export function renderSeatEmail(kind: SeatEmailKind, d: SeatEmailData): {
  subject: string
  html: string
  text: string
} {
  const copy = copyFor(kind, d)
  const ctaUrl =
    kind === 'seller_new'
      ? d.adminUrl ?? d.trackerUrl
      : kind === 'cancelled' || kind === 'expired'
        ? d.eventUrl
        : d.trackerUrl

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;font-size:12px;color:rgba(255,255,255,0.5);vertical-align:top;width:110px;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:13px;color:#ffffff;">${escapeHtml(value)}</td></tr>`

  const details = [
    row('Reference', d.reference),
    row('Seats', `${d.quantity} × ${d.categoryLabel}`),
    row('Where', d.seatsLine),
    row('Total', d.totalLabel),
    ...(d.sellerName ? [row('Sold by', d.sellerName)] : []),
  ].join('')

  const html = `
  <div style="background:#08080c;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;">
      <p style="margin:0 0 24px;font-size:18px;font-weight:800;letter-spacing:0.08em;color:#ffffff;">ALBA<span style="color:#ee1c25;">GO</span></p>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.09);border-radius:20px;padding:28px;">
        <h1 style="margin:0;font-size:24px;line-height:1.15;color:#ffffff;">${escapeHtml(copy.heading)}</h1>
        <p style="margin:14px 0 0;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#ee1c25;">${escapeHtml(d.kicker)}</p>
        <p style="margin:6px 0 0;font-size:19px;font-weight:700;color:#ffffff;">${escapeHtml(d.eventTitle)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">${escapeHtml(d.venueLine)}</p>
        ${copy.body
          .map(
            (p) =>
              `<p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:rgba(255,255,255,0.78);">${escapeHtml(p)}</p>`,
          )
          .join('')}
        <table style="margin:20px 0 0;border-collapse:collapse;width:100%;border-top:1px solid rgba(255,255,255,0.08);">${details}</table>
        <a href="${ctaUrl}" style="display:inline-block;margin-top:22px;padding:12px 22px;background:#ee1c25;border-radius:999px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(copy.cta)}</a>
      </div>
      <p style="margin:20px 0 0;font-size:11px;line-height:1.5;color:rgba(255,255,255,0.35);">
        Questions? Just reply to this email and mention your reference ${escapeHtml(d.reference)}.
      </p>
    </div>
  </div>`

  const text = [
    copy.heading,
    '',
    d.kicker,
    d.eventTitle,
    d.venueLine,
    '',
    ...copy.body,
    '',
    `Reference: ${d.reference}`,
    `Seats: ${d.quantity} × ${d.categoryLabel}`,
    `Where: ${d.seatsLine}`,
    `Total: ${d.totalLabel}`,
    ...(d.sellerName ? [`Sold by: ${d.sellerName}`] : []),
    '',
    `${copy.cta}: ${ctaUrl}`,
  ].join('\n')

  return { subject: copy.subject, html, text }
}
