import { foldText } from './text'

// Moved from lib/lens/resolve.ts (Phase 0 B4) — pure, customer-neutral matching.

// ---------------------------------------------------------------------------
// Venue name matching — pure logic, exported for the scripted tests.
// ---------------------------------------------------------------------------

// Venue-type words that carry no identity (en + sq, folded forms). Stripped
// only from the leading/trailing edges of a name, never the middle.
const NOISE_WORDS = new Set([
  'club',
  'klub',
  'klubi',
  'bar',
  'bari',
  'pub',
  'lounge',
  'cafe',
  'kafe',
  'kafene',
  'restorant',
  'restaurant',
  'teatri',
  'teater',
  'kinema',
  'cinema',
  'pallati',
  'stadiumi',
  'stadium',
  'arena',
  'disco',
  'disko',
  'the',
])

function tokenize(value: string): string[] {
  return foldText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/**
 * Fold + tokenize + strip leading/trailing noise words. When stripping
 * leaves a core under 3 characters ("Club 21" → "21"), the unstripped
 * tokens are used instead so short names can't match everything.
 */
export function normalizeVenueTokens(name: string): string[] {
  const tokens = tokenize(name)
  let start = 0
  let end = tokens.length
  while (start < end && NOISE_WORDS.has(tokens[start])) start++
  while (end > start && NOISE_WORDS.has(tokens[end - 1])) end--
  const core = tokens.slice(start, end)
  if (core.join('').length < 3) return tokens
  return core
}

function isSubset(small: string[], big: string[]): boolean {
  const set = new Set(big)
  return small.every((t) => set.has(t))
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  let inter = 0
  for (const t of setA) if (setB.has(t)) inter++
  const union = setA.size + setB.size - inter
  return union === 0 ? 0 : inter / union
}

export type VenueTier = {
  tier: 'matched' | 'suggested' | 'none'
  /** Orders candidates within a tier; higher = better. */
  rank: number
}

/**
 * Deterministic match tiers (spec §Stage B) — no opaque score threshold:
 * - matched: normalized names equal, or one token set contained in the
 *   other with ≥2 tokens or a single distinctive token ≥5 chars.
 * - suggested: token-set Jaccard ≥ 0.5.
 */
export function venueMatchTier(readingName: string, candidateName: string): VenueTier {
  const a = normalizeVenueTokens(readingName)
  const b = normalizeVenueTokens(candidateName)
  if (a.length === 0 || b.length === 0) return { tier: 'none', rank: 0 }

  const overlap = jaccard(a, b)

  if (a.join(' ') === b.join(' ')) return { tier: 'matched', rank: 3 + overlap }

  const [small, big] = a.length <= b.length ? [a, b] : [b, a]
  if (isSubset(small, big)) {
    const distinctive = small.length >= 2 || small[0].length >= 5
    if (distinctive) return { tier: 'matched', rank: 2 + overlap }
    // "21" ⊂ "Arena 21" is not evidence — fall through to suggestion tiers.
  }

  if (overlap >= 0.5) return { tier: 'suggested', rank: 1 + overlap }
  return { tier: 'none', rank: 0 }
}

// ---------------------------------------------------------------------------
// Duplicate title matching — pure logic, exported for the scripted tests.
// ---------------------------------------------------------------------------

/**
 * Spec §Stage D title comparison. Two event titles are the same event when
 * their folded token sets have Jaccard ≥ 0.6, OR one set fully contains the
 * other (a reworded/abbreviated title of the same event). Candidates are
 * already narrowed to identical date + location by the DB query, so the title
 * only has to disambiguate within that tight set.
 */
export function titlesMatch(a: string, b: string): boolean {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.length === 0 || tb.length === 0) return false
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  if (isSubset(small, big)) return true
  return jaccard(ta, tb) >= 0.6
}

// ---------------------------------------------------------------------------
// City matching — pure logic, exported for the scripted tests.
// ---------------------------------------------------------------------------

/**
 * Albanian city names flip their final vowel between definite/indefinite
 * forms (Tirana/Tiranë, Vlora/Vlorë, Durrësi/Durrës). Stemming trailing
 * vowels + a trailing 'i' lets those meet without fuzzy-matching geography.
 */
export function stemCityName(folded: string): string {
  let s = folded.replace(/[aei]+$/g, '')
  if (s.length < 4) s = folded
  return s
}

// ---------------------------------------------------------------------------
// Geo helpers — pure, exported for the scripted tests.
// ---------------------------------------------------------------------------

export function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const [lngA, latA] = a
  const [lngB, latB] = b
  const dLat = toRad(latB - latA)
  const dLng = toRad(lngB - lngA)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Spec §Stage C: a geocoded address must land near the resolved city. */
export const GEOCODE_SANITY_RING_KM = 30
