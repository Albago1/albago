/**
 * How a buyer pays for held seats: a scan-to-pay bank transfer QR code
 * (GiroCode — the EPC standard every German banking app reads) and a
 * PayPal.me link with the amount filled in. Pure helpers; the account
 * details themselves live in `seat_payment_settings` (admin-only).
 */

export type SeatPaymentSettings = {
  event_id: string
  bank_holder: string | null
  iban: string | null
  bic: string | null
  paypal_me: string | null
  /** Seller WhatsApp, international digits (lib/seats/whatsapp). */
  whatsapp: string | null
  /** false = only buyers with a reservation get the WhatsApp button. */
  whatsapp_public: boolean
  updated_at: string
}

/** What the seat console receives: the IBAN only masked. */
export type SeatPaymentAdminView = {
  bankHolder: string | null
  ibanMasked: string | null
  bic: string | null
  paypalMe: string | null
  whatsapp: string | null
  whatsappPublic: boolean
  updatedAt: string
}

export function adminPaymentView(s: SeatPaymentSettings): SeatPaymentAdminView {
  return {
    bankHolder: s.bank_holder,
    ibanMasked: s.iban ? maskIban(s.iban) : null,
    bic: s.bic,
    paypalMe: s.paypal_me,
    whatsapp: s.whatsapp ?? null,
    whatsappPublic: s.whatsapp_public ?? true,
    updatedAt: s.updated_at,
  }
}

/** What a buyer's browser receives — never the account name or IBAN as text. */
export type SeatPaymentView = {
  reference: string
  amount_cents: number
  currency: string
  expires_at: string | null
  /** PNG data URL of the GiroCode, or null when no bank account is set. */
  qr: string | null
  /** paypal.me link with the amount, or null when no PayPal name is set. */
  paypal: string | null
}

/** "de89 3704 0044…" → "DE89370400440532013000" */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/** ISO 13616 check: shape plus the mod-97 checksum. */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const moved = iban.slice(4) + iban.slice(0, 4)
  const digits = moved.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55))
  let rest = 0
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97
  return rest === 1
}

export function normalizeBic(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

export function isValidBic(raw: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalizeBic(raw))
}

/** "paypal.me/Name", "https://www.paypal.com/paypalme/Name" or "Name" → "Name" */
export function normalizePaypalMe(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?paypal\.(me|com\/paypalme)\//i, '')
    .replace(/\/.*$/, '')
}

export function isValidPaypalMe(raw: string): boolean {
  return /^[A-Za-z0-9]{1,20}$/.test(normalizePaypalMe(raw))
}

/** "DE89 •••• •••• •••• 3000" for showing a saved IBAN without exposing it. */
export function maskIban(iban: string): string {
  const clean = normalizeIban(iban)
  return `${clean.slice(0, 4)} •••• •••• ${clean.slice(-4)}`
}

const euros = (cents: number) => (cents / 100).toFixed(2)

/**
 * EPC069-12 "BCD" payload (version 002: BIC optional inside the EEA). The
 * banking app fills in name, IBAN, amount and reference from it. The name
 * must match the account exactly — banks check it before sending.
 */
export function epcPayload(p: { holder: string; iban: string; bic?: string | null; amountCents: number; remittance: string }): string {
  return [
    'BCD',
    '002',
    '1', // UTF-8
    'SCT',
    p.bic ? normalizeBic(p.bic) : '',
    p.holder.trim().slice(0, 70),
    normalizeIban(p.iban),
    `EUR${euros(p.amountCents)}`,
    '', // purpose code
    '', // structured creditor reference (unused: plain reference below)
    p.remittance.trim().slice(0, 140),
  ].join('\n')
}

export function paypalMeUrl(name: string, amountCents: number, currency = 'EUR'): string {
  return `https://paypal.me/${encodeURIComponent(normalizePaypalMe(name))}/${euros(amountCents)}${currency}`
}
