import { foldText } from './text'

/**
 * Locality canonicalisation + country timezones. Neutral world data, not a
 * consumer rule: "Tiranë" / "Tirane" / "Tirana" are the same city for anyone.
 * Unknown localities pass through cleaned (never invented, never dropped).
 */

// canonical name → [country, ...variant spellings (folded)]
const LOCALITIES: Record<string, [string, ...string[]]> = {
  Tirana: ['AL', 'tirana', 'tirane', 'tiranë'],
  Durrës: ['AL', 'durres', 'durresi', 'durrës'],
  Vlorë: ['AL', 'vlore', 'vlora', 'vlorë'],
  Shkodër: ['AL', 'shkoder', 'shkodra', 'shkodër'],
  Korçë: ['AL', 'korce', 'korca', 'korçë'],
  Elbasan: ['AL', 'elbasan', 'elbasani'],
  Fier: ['AL', 'fier', 'fieri'],
  Berat: ['AL', 'berat', 'berati'],
  Sarandë: ['AL', 'sarande', 'saranda', 'sarandë'],
  Himarë: ['AL', 'himare', 'himara', 'himarë'],
  Ksamil: ['AL', 'ksamil'],
  Gjirokastër: ['AL', 'gjirokaster', 'gjirokastra', 'gjirokastër'],
  Prishtina: ['XK', 'prishtina', 'prishtine', 'prishtinë', 'pristina', 'priština'],
  Prizren: ['XK', 'prizren', 'prizreni'],
  Peja: ['XK', 'peja', 'pejë', 'peje', 'peć'],
  Gjakova: ['XK', 'gjakova', 'gjakove', 'gjakovë'],
  Ferizaj: ['XK', 'ferizaj', 'ferizaji'],
  Mitrovica: ['XK', 'mitrovica', 'mitrovice', 'mitrovicë'],
  Tetovo: ['MK', 'tetovo', 'tetove', 'tetova', 'tetovë'],
  Skopje: ['MK', 'skopje', 'shkup', 'shkupi'],
  Struga: ['MK', 'struga', 'strugë'],
  Ulcinj: ['ME', 'ulcinj', 'ulqin', 'ulqini'],
  Podgorica: ['ME', 'podgorica', 'podgorice'],
  Preševo: ['RS', 'presevo', 'preševo', 'presheve', 'preshevë'],
  Berlin: ['DE', 'berlin'],
  Munich: ['DE', 'munich', 'munchen', 'münchen', 'mynih'],
  Hamburg: ['DE', 'hamburg'],
  Frankfurt: ['DE', 'frankfurt', 'frankfurt am main'],
  Stuttgart: ['DE', 'stuttgart', 'shtutgart'],
  Düsseldorf: ['DE', 'dusseldorf', 'düsseldorf'],
  Cologne: ['DE', 'cologne', 'koln', 'köln', 'keln'],
  Zurich: ['CH', 'zurich', 'zürich', 'cyrih'],
  Geneva: ['CH', 'geneva', 'geneve', 'genève', 'gjeneve', 'genf'],
  Basel: ['CH', 'basel', 'bazel'],
  Bern: ['CH', 'bern', 'berne'],
  Vienna: ['AT', 'vienna', 'wien', 'vjene', 'vjenë'],
  Milan: ['IT', 'milan', 'milano'],
  Rome: ['IT', 'rome', 'roma'],
  London: ['GB', 'london', 'londer', 'londër', 'londra'],
  'New York': ['US', 'new york', 'new york city', 'nyc', 'nju jork'],
  Stockholm: ['SE', 'stockholm', 'stokholm'],
  Brussels: ['BE', 'brussels', 'bruxelles', 'brussel', 'bruksel'],
  Paris: ['FR', 'paris', 'parisi'],
  Athens: ['GR', 'athens', 'athina', 'athine', 'athinë'],
  Thessaloniki: ['GR', 'thessaloniki', 'selanik'],
}

const BY_VARIANT = new Map<string, { name: string; country: string }>()
for (const [name, [country, ...variants]] of Object.entries(LOCALITIES)) {
  for (const v of [name, ...variants]) BY_VARIANT.set(foldText(v), { name, country })
}

/** Canonical locality name + its country when known; otherwise the cleaned input, country null. */
export function canonicalLocality(raw: string | null | undefined): { name: string; country: string | null } | null {
  if (!raw) return null
  // Sources write "Tiranë, Albania" or "Tirana 1001": keep the first segment, drop postcodes.
  const first = raw.split(/[,|/]/)[0].replace(/\b\d{3,6}\b/g, '').replace(/\s+/g, ' ').trim()
  if (!first) return null
  const hit = BY_VARIANT.get(foldText(first))
  return hit ? { name: hit.name, country: hit.country } : { name: first, country: null }
}

/** Find a known locality mentioned inside free text (address, venue line). */
export function localityInText(text: string | null | undefined): { name: string; country: string } | null {
  if (!text) return null
  const folded = ` ${foldText(text).replace(/[^a-z0-9\s]/g, ' ')} `
  for (const [variant, hit] of BY_VARIANT) {
    if (variant.length >= 4 && folded.includes(` ${variant} `)) return hit
  }
  return null
}

const TIMEZONES: Record<string, string> = {
  AL: 'Europe/Tirane', XK: 'Europe/Belgrade', MK: 'Europe/Skopje', ME: 'Europe/Podgorica', RS: 'Europe/Belgrade',
  GR: 'Europe/Athens', DE: 'Europe/Berlin', CH: 'Europe/Zurich', AT: 'Europe/Vienna', IT: 'Europe/Rome',
  GB: 'Europe/London', FR: 'Europe/Paris', BE: 'Europe/Brussels', NL: 'Europe/Amsterdam', SE: 'Europe/Stockholm',
  NO: 'Europe/Oslo', DK: 'Europe/Copenhagen', FI: 'Europe/Helsinki', HR: 'Europe/Zagreb', TR: 'Europe/Istanbul',
  ES: 'Europe/Madrid',
}

/** IANA zone for single-zone countries; null where a country spans zones (US, CA, AU…). */
export function timezoneForCountry(countryCode: string | null): string | null {
  return countryCode ? (TIMEZONES[countryCode] ?? null) : null
}
