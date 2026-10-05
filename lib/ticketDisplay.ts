// Display helpers for the structured external-ticket fields on events
// (ticket_url, price_from_cents, …). Native ticket tiers (TIX track) will
// supersede these per-event once they ship; until then external links are
// how ticketed events point buyers somewhere.

/** Only http(s) URLs may render as external-action hrefs — a stray
 *  `javascript:` or malformed value in the DB must never become a link. */
export function safeExternalUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.toString()
      : null
  } catch {
    return null
  }
}

// Importers sometimes store a placeholder in the free-text price column.
// Rendering "Unknown" next to an event reads as broken data, so these count
// as no price at all.
const PRICE_PLACEHOLDERS = new Set([
  'unknown',
  'price unknown',
  'tba',
  'tbd',
  'to be announced',
  'n/a',
  '-',
  '—',
  '?',
])

/** The free-text price as it should be shown publicly, or null when there is
 *  nothing real to show. */
export function displayPrice(price: string | null | undefined): string | null {
  const trimmed = price?.trim()
  if (!trimmed) return null
  return PRICE_PLACEHOLDERS.has(trimmed.toLowerCase()) ? null : trimmed
}

// First money amount in a label: "€25", "25 €", "1,000 lekë", "ALL 5,000".
// The lookahead (not \b) ends the currency word, because \b doesn't treat "ë"
// as a letter.
const PRICE_AMOUNT =
  /[€$£]\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|\$|£|lekë|leke|lek|all|eur|usd|gbp|chf)(?![a-z])|(?:all|eur|usd|gbp|chf)\s?\d[\d.,]*/i

/** Card pills fit an amount, not a sentence: "Phase 1 Pre-sale Ticket
 *  1,000 lekë" → "1,000 lekë". Short labels, and labels with no recognisable
 *  amount, pass through unchanged. */
export function compactPrice(label: string): string {
  if (label.length <= 14) return label
  return label.match(PRICE_AMOUNT)?.[0] ?? label
}

export function formatPriceFrom(cents: number, currency: string | null): string {
  const amount = cents / 100
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: (currency ?? 'EUR').toUpperCase(),
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Unknown currency code in the DB — degrade to "25 XYZ" rather than crash.
    return `${amount} ${currency ?? ''}`.trim()
  }
}
