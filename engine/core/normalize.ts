import { foldText } from './text'
import type { PriceV1 } from '../contract/occurrence'

/**
 * Deterministic normalization (absorbs Phase 41 steps 41.2–41.4): free-text
 * country names → ISO 3166-1 alpha-2, price wording → PriceV1. Unknown input
 * stays null — never guessed.
 */

// Country names as sources write them (en / sq / de / it / fr / native).
const COUNTRY_NAMES: Record<string, string> = {
  albania: 'AL', shqiperia: 'AL', shqiperi: 'AL', albanien: 'AL', albanie: 'AL',
  kosovo: 'XK', kosova: 'XK', kosove: 'XK', 'republic of kosovo': 'XK',
  'north macedonia': 'MK', macedonia: 'MK', maqedonia: 'MK', 'maqedonia e veriut': 'MK', nordmazedonien: 'MK', 'северна македонија': 'MK',
  montenegro: 'ME', 'mali i zi': 'ME', 'crna gora': 'ME',
  serbia: 'RS', serbien: 'RS',
  greece: 'GR', greqia: 'GR', griechenland: 'GR',
  germany: 'DE', deutschland: 'DE', gjermania: 'DE', allemagne: 'DE', germania: 'DE',
  switzerland: 'CH', schweiz: 'CH', zvicra: 'CH', suisse: 'CH', svizzera: 'CH',
  austria: 'AT', osterreich: 'AT', 'oesterreich': 'AT', austri: 'AT', autriche: 'AT',
  italy: 'IT', italia: 'IT', italien: 'IT', italie: 'IT',
  'united kingdom': 'GB', uk: 'GB', 'great britain': 'GB', england: 'GB', 'mbreteria e bashkuar': 'GB', anglia: 'GB',
  'united states': 'US', usa: 'US', 'united states of america': 'US', amerika: 'US', sha: 'US',
  france: 'FR', franca: 'FR', frankreich: 'FR',
  belgium: 'BE', belgique: 'BE', belgie: 'BE', belgien: 'BE', 'belgie / belgique / belgien': 'BE', belgjika: 'BE',
  netherlands: 'NL', nederland: 'NL', holland: 'NL', holanda: 'NL',
  sweden: 'SE', sverige: 'SE', suedia: 'SE', norway: 'NO', norge: 'NO', norvegjia: 'NO',
  denmark: 'DK', danmark: 'DK', finland: 'FI', suomi: 'FI',
  croatia: 'HR', hrvatska: 'HR', turkey: 'TR', turkiye: 'TR', turqia: 'TR',
  spain: 'ES', espana: 'ES', canada: 'CA', australia: 'AU',
}

/** Free-text or code country → ISO alpha-2, or null when unrecognised. */
export function countryToIso(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const code = trimmed.toUpperCase()
    return code === 'UK' ? 'GB' : code
  }
  const key = foldText(trimmed).replace(/\s+/g, ' ').replace(/[.]/g, '').trim()
  return COUNTRY_NAMES[key] ?? null
}

const FREE_WORDS =
  /\b(free|free entry|free admission|hyrja (?:e )?lire|hyrje (?:e )?lire|hyrja falas|falas|gratis|kostenlos|eintritt frei|entrata libera|ingresso libero|gratuit|entree libre)\b/i

const CURRENCY_SYMBOLS: Array<[RegExp, string]> = [
  [/€|\beur(o|os)?\b/i, 'EUR'],
  [/\ball\b|\blek(e|ë)?\b|\blekë\b/i, 'ALL'],
  [/\bchf\b|\bfr\.?\b/i, 'CHF'],
  [/£|\bgbp\b/i, 'GBP'],
  [/\$|\busd\b/i, 'USD'],
  [/\bden(ar)?\b|\bmkd\b/i, 'MKD'],
]

const NUMBER = String.raw`\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`
const CURRENCY_TOKEN = String.raw`€|£|\$|eur(?:o|os)?|all|lek(?:e|ë)?|chf|fr\.?|gbp|usd|den(?:ar)?|mkd`
// An amount counts only when a currency is written right next to it
// ("1,000 lekë", "€22") — so "Phase 1 Pre-sale…" can't become a price of 1.
const AMOUNT_NEXT_TO_CURRENCY = new RegExp(
  String.raw`(?:(?:${CURRENCY_TOKEN})\s*(${NUMBER}))|(?:(${NUMBER})\s*(?:${CURRENCY_TOKEN})(?![a-z]))`,
  'gi',
)

function toNumber(raw: string): number {
  return Number(raw.replace(/[\s.,](?=\d{3}\b)/g, '').replace(',', '.'))
}

function amountsInPriceText(note: string): number[] {
  return Array.from(note.matchAll(AMOUNT_NEXT_TO_CURRENCY))
    .map((m) => toNumber(m[1] ?? m[2] ?? ''))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1_000_000)
}

/** Price wording → PriceV1. "Unknown" stays unknown; "0" alone is not "free". */
export function parsePrice(text: string | null, minHint: number | null = null, currencyHint: string | null = null): PriceV1 {
  const note = text?.trim() ? text.trim().slice(0, 500) : null
  if (!note && minHint == null) return { state: 'unknown', min: null, max: null, currency: null, note: null }
  if (note && FREE_WORDS.test(foldText(note))) {
    return { state: 'free', min: null, max: null, currency: null, note }
  }
  let currency = currencyHint && /^[A-Z]{3}$/.test(currencyHint) ? currencyHint : null
  if (!currency && note) currency = CURRENCY_SYMBOLS.find(([re]) => re.test(note))?.[1] ?? null
  const amounts = note ? amountsInPriceText(note) : []
  if (minHint != null && minHint > 0) amounts.push(minHint)
  if (amounts.length === 0) return { state: 'unknown', min: null, max: null, currency: null, note }
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  if (!currency) return { state: 'unknown', min: null, max: null, currency: null, note }
  return { state: 'paid', min, max: max > min ? max : null, currency, note }
}

/** "21:00" / "21.00" / "9 PM" / "21h" → "21:00"; a bare number or anything else → null. */
export function normalizeTime(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|h)?$/)
  if (!m || (m[2] == null && !m[3])) return null
  let h = Number(m[1])
  const min = m[2] == null ? 0 : Number(m[2])
  if (m[3] === 'pm' && h < 12) h += 12
  if (m[3] === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Strict YYYY-MM-DD that is a real calendar date, else null. */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`)
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() + 1 === Number(m[2]) && d.getUTCDate() === Number(m[3])
    ? `${m[1]}-${m[2]}-${m[3]}`
    : null
}
