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
  Krujë: ['AL', 'kruje', 'kruja', 'krujë'],
  Lezhë: ['AL', 'lezhe', 'lezha', 'lezhë'],
  Pogradec: ['AL', 'pogradec', 'pogradeci'],
  Kavajë: ['AL', 'kavaje', 'kavaja', 'kavajë'],
  Lushnjë: ['AL', 'lushnje', 'lushnja', 'lushnjë'],
  Shëngjin: ['AL', 'shengjin', 'shëngjin', 'shengjini'],
  Velipojë: ['AL', 'velipoje', 'velipoja', 'velipojë'],
  Dhërmi: ['AL', 'dhermi', 'dhërmi', 'dhermiu'],
  Prishtina: ['XK', 'prishtina', 'prishtine', 'prishtinë', 'pristina', 'priština'],
  Prizren: ['XK', 'prizren', 'prizreni'],
  Peja: ['XK', 'peja', 'pejë', 'peje', 'peć'],
  Gjakova: ['XK', 'gjakova', 'gjakove', 'gjakovë'],
  Ferizaj: ['XK', 'ferizaj', 'ferizaji'],
  Mitrovica: ['XK', 'mitrovica', 'mitrovice', 'mitrovicë'],
  Gjilan: ['XK', 'gjilan', 'gjilani', 'gnjilane'],
  Podujeva: ['XK', 'podujeva', 'podujeve', 'podujevë'],
  Tetovo: ['MK', 'tetovo', 'tetove', 'tetova', 'tetovë'],
  Skopje: ['MK', 'skopje', 'shkup', 'shkupi'],
  Struga: ['MK', 'struga', 'strugë'],
  Gostivar: ['MK', 'gostivar', 'gostivari'],
  Kičevo: ['MK', 'kicevo', 'kičevo', 'kercove', 'kërçovë'],
  Ulcinj: ['ME', 'ulcinj', 'ulqin', 'ulqini'],
  Podgorica: ['ME', 'podgorica', 'podgorice'],
  Tuzi: ['ME', 'tuzi', 'tuz'],
  Preševo: ['RS', 'presevo', 'preševo', 'presheve', 'preshevë'],
  Bujanovac: ['RS', 'bujanovac', 'bujanoc'],
  Berlin: ['DE', 'berlin'],
  Munich: ['DE', 'munich', 'munchen', 'münchen', 'mynih', 'mynihu'],
  Hamburg: ['DE', 'hamburg'],
  Frankfurt: ['DE', 'frankfurt', 'frankfurt am main', 'frankfurti', 'frankfurti mbi main'],
  Nuremberg: ['DE', 'nuremberg', 'nurnberg', 'nürnberg'],
  Bremen: ['DE', 'bremen'],
  Dortmund: ['DE', 'dortmund'],
  Stuttgart: ['DE', 'stuttgart', 'shtutgart'],
  Düsseldorf: ['DE', 'dusseldorf', 'düsseldorf'],
  Cologne: ['DE', 'cologne', 'koln', 'köln', 'keln'],
  Zurich: ['CH', 'zurich', 'zürich', 'cyrih'],
  Geneva: ['CH', 'geneva', 'geneve', 'genève', 'gjeneve', 'genf'],
  Basel: ['CH', 'basel', 'bazel'],
  Bern: ['CH', 'bern', 'berne'],
  Lausanne: ['CH', 'lausanne', 'lozane', 'lozanë'],
  'St. Gallen': ['CH', 'st. gallen', 'st gallen', 'st.gallen', 'sankt gallen', 'san gallo'],
  Lucerne: ['CH', 'lucerne', 'luzern'],
  Winterthur: ['CH', 'winterthur'],
  Vienna: ['AT', 'vienna', 'wien', 'vjene', 'vjenë'],
  Graz: ['AT', 'graz'],
  Linz: ['AT', 'linz'],
  Milan: ['IT', 'milan', 'milano'],
  Rome: ['IT', 'rome', 'roma'],
  Turin: ['IT', 'turin', 'torino'],
  Florence: ['IT', 'florence', 'firenze'],
  Genoa: ['IT', 'genoa', 'genova'],
  Bari: ['IT', 'bari'],
  London: ['GB', 'london', 'londer', 'londër', 'londra', 'city of london', 'city of westminster', 'westminster'],
  Birmingham: ['GB', 'birmingham'],
  'New York': ['US', 'new york', 'new york city', 'nyc', 'nju jork', 'bronx', 'the bronx', 'staten island', 'brooklyn', 'queens', 'manhattan'],
  Detroit: ['US', 'detroit'],
  Chicago: ['US', 'chicago'],
  Boston: ['US', 'boston'],
  Philadelphia: ['US', 'philadelphia'],
  Toronto: ['CA', 'toronto'],
  Stockholm: ['SE', 'stockholm', 'stokholm'],
  Malmö: ['SE', 'malmo', 'malmö'],
  Oslo: ['NO', 'oslo'],
  Copenhagen: ['DK', 'copenhagen', 'kobenhavn', 'københavn'],
  Amsterdam: ['NL', 'amsterdam'],
  Brussels: ['BE', 'brussels', 'bruxelles', 'brussel', 'bruksel', 'bruxelles brussel', 'bruxelles - brussel'],
  Luxembourg: ['LU', 'luxembourg', 'luxemburg', 'luksemburg'],
  Paris: ['FR', 'paris', 'parisi'],
  Athens: ['GR', 'athens', 'athina', 'athine', 'athinë', 'athen'],
  Thessaloniki: ['GR', 'thessaloniki', 'selanik'],
}

const BY_VARIANT = new Map<string, { name: string; country: string }>()
for (const [name, [country, ...variants]] of Object.entries(LOCALITIES)) {
  for (const v of [name, ...variants]) BY_VARIANT.set(foldText(v), { name, country })
}

// Administrative words geocoders put in front of a city name: "Bashkia Durrës"
// (municipality of), "Qendër Vlorë" (centre), "Stadtgebiet Bremen".
const ADMIN_PREFIX = /^(bashkia|komuna|qarku|qendër|qender|njësia administrative|njesia administrative|municipality of|stadtgebiet|landeshauptstadt|stadt|gemeinde|comune di|ville de)\s+(e\s+|i\s+|di\s+|de\s+)?/i

/** Canonical locality name + its country when known; otherwise the cleaned input, country null. */
export function canonicalLocality(raw: string | null | undefined): { name: string; country: string | null } | null {
  if (!raw) return null
  // Sources write "Tiranë, Albania" or "Tirana 1001": keep the first segment, drop postcodes.
  const first = raw.split(/[,|/]/)[0].replace(/\b\d{3,6}\b/g, '').replace(/\s+/g, ' ').trim()
  if (!first) return null
  const exact = BY_VARIANT.get(foldText(first))
  if (exact) return { name: exact.name, country: exact.country }
  const bare = first.replace(ADMIN_PREFIX, '').trim() || first
  const hit = BY_VARIANT.get(foldText(bare))
  return hit ? { name: hit.name, country: hit.country } : { name: bare, country: null }
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
  ES: 'Europe/Madrid', LU: 'Europe/Luxembourg', CZ: 'Europe/Prague', PL: 'Europe/Warsaw', MT: 'Europe/Malta',
  IE: 'Europe/Dublin', PT: 'Europe/Lisbon', HU: 'Europe/Budapest', SI: 'Europe/Ljubljana', BA: 'Europe/Sarajevo',
}

/** IANA zone for single-zone countries; null where a country spans zones (US, CA, AU…). */
export function timezoneForCountry(countryCode: string | null): string | null {
  return countryCode ? (TIMEZONES[countryCode] ?? null) : null
}
