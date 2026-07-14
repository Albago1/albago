// Display helpers for the structured external-ticket fields on events
// (ticket_url, price_from_cents, …). Native ticket tiers (TIX track) will
// supersede these per-event once they ship; until then external links are
// how ticketed events point buyers somewhere.

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
