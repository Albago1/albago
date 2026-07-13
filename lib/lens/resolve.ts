import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { foldText } from '@/lib/mapSearch'
import { fetchLocations, type LocationOption } from '@/lib/locations'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PosterReading } from '@/lib/ai/posterReader'

/**
 * AlbaGo Lens resolution layer (master plan LENS-2a): turns the raw poster
 * reading into resolved entities — a real city slug, a linked venue with
 * coordinates, a geocoded address. Spec: docs/master-plan/05-lens.md.
 *
 * Governing rule (inherited from the extraction contract): a wrong
 * resolution is worse than none. Venues auto-apply only on strong,
 * deterministic evidence; medium evidence is surfaced as a suggestion the
 * user confirms; ties demote to suggestion because two plausible venues
 * means the machine does not actually know.
 *
 * The caller (POST /api/lens) wraps resolvePoster in try/catch — any
 * failure here degrades the scan to the LENS-1 reading-only response.
 */

export type LensResolvedPlace = {
  id: string
  name: string
  slug: string
  address: string | null
  lat: number | null
  lng: number | null
  city: string | null
  location_slug: string
}

export type LensCityResolution = {
  status: 'matched' | 'remote' | 'inherited' | 'none'
  slug: string
  label: string
  country: string
  region?: string
  /** [lng, lat] — map convention used across the codebase. */
  center?: [number, number]
}

export type LensVenueResolution = {
  status: 'matched' | 'suggested' | 'none'
  place?: LensResolvedPlace
}

export type LensGeocodeResolution = {
  status: 'address' | 'none'
  lat?: number
  lng?: number
  formatted?: string
}

export type LensDuplicateResolution = {
  status: 'live' | 'in_review' | 'none'
  /** slug/title/date returned ONLY for a published ('live') hit. A pending
   *  submission match is boolean-only — submissions are not public. */
  event?: { slug: string; title: string; date: string }
}

export type LensResolution = {
  city: LensCityResolution
  venue: LensVenueResolution
  geocode: LensGeocodeResolution
  duplicate: LensDuplicateResolution
}

const NONE_CITY: LensCityResolution = {
  status: 'none',
  slug: '',
  label: '',
  country: '',
}

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

/**
 * Pick the venue resolution from a candidate pool. Two candidates that both
 * qualify as matched = the machine doesn't know → demote to suggestion with
 * the best one (spec: tie demotion).
 */
export function matchVenueCandidates(
  readingVenue: string,
  candidates: LensResolvedPlace[],
): LensVenueResolution {
  if (!readingVenue.trim() || candidates.length === 0) return { status: 'none' }

  let bestMatched: { place: LensResolvedPlace; rank: number } | null = null
  let matchedCount = 0
  let bestSuggested: { place: LensResolvedPlace; rank: number } | null = null

  for (const place of candidates) {
    const { tier, rank } = venueMatchTier(readingVenue, place.name)
    if (tier === 'matched') {
      matchedCount++
      if (!bestMatched || rank > bestMatched.rank) bestMatched = { place, rank }
    } else if (tier === 'suggested') {
      if (!bestSuggested || rank > bestSuggested.rank) bestSuggested = { place, rank }
    }
  }

  if (bestMatched) {
    return {
      status: matchedCount > 1 ? 'suggested' : 'matched',
      place: bestMatched.place,
    }
  }
  if (bestSuggested) return { status: 'suggested', place: bestSuggested.place }
  return { status: 'none' }
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

export function matchCityLocal(
  cityText: string,
  options: LocationOption[],
): LocationOption | null {
  const folded = foldText(cityText.trim())
  if (!folded) return null
  for (const option of options) {
    if (
      foldText(option.label) === folded ||
      option.slug === folded.replace(/\s+/g, '-') ||
      (option.city && foldText(option.city) === folded)
    ) {
      return option
    }
  }
  const stem = stemCityName(folded)
  if (stem.length < 4) return null
  for (const option of options) {
    if (stemCityName(foldText(option.label)) === stem) return option
    if (option.city && stemCityName(foldText(option.city)) === stem) return option
  }
  return null
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

// ---------------------------------------------------------------------------
// Nominatim (server-side) — descriptive User-Agent per usage policy, global
// 1 req/s spacing, 2s timeout. Failures return null; callers degrade.
// ---------------------------------------------------------------------------

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'AlbaGo-Lens/1.0 (https://www.albago.org)',
}

let lastNominatimAt = 0

async function nominatimJson(url: string): Promise<unknown | null> {
  try {
    const wait = 1000 - (Date.now() - lastNominatimAt)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastNominatimAt = Date.now()
    const res = await fetch(url, {
      headers: NOMINATIM_HEADERS,
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

type NominatimHit = {
  lat: string
  lon: string
  display_name: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    country?: string
  }
}

function slugifyCityName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

async function resolveCityRemote(
  reading: PosterReading,
): Promise<LensCityResolution | null> {
  // The country is part of the query, so Nominatim already biases to the
  // right country. We deliberately do NOT re-check country names client-side:
  // requesting results in the poster's language returns localized country
  // names ("Shqipëria" not "Albania") that can't be reliably compared to the
  // reading's country string across languages — that comparison produced
  // false negatives for valid cities. We instead require a real place hit
  // (populated city/town/village) and take the top one.
  const query = [reading.city, reading.country].filter(Boolean).join(', ')
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
    `&format=json&limit=3&addressdetails=1&accept-language=${reading.language}`
  const raw = await nominatimJson(url)
  if (!Array.isArray(raw)) return null

  for (const hit of raw as NominatimHit[]) {
    const a = hit.address ?? {}
    const cityName = a.city || a.town || a.village || a.municipality || ''
    if (!cityName) continue
    const slug = slugifyCityName(cityName)
    if (!slug) continue
    return {
      status: 'remote',
      slug,
      label: cityName,
      country: a.country ?? reading.country,
      center: [parseFloat(hit.lon), parseFloat(hit.lat)],
    }
  }
  return null
}

async function geocodeAddress(
  reading: PosterReading,
  city: LensCityResolution,
): Promise<LensGeocodeResolution> {
  // Without a city center there is no sanity ring, and unconstrained
  // geocoding of poster addresses produces confident garbage — skip.
  if (!city.center) return { status: 'none' }

  const url =
    `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(reading.address)}` +
    `&city=${encodeURIComponent(city.label)}` +
    (city.country ? `&country=${encodeURIComponent(city.country)}` : '') +
    `&format=json&limit=1&accept-language=${reading.language}`
  const raw = await nominatimJson(url)
  if (!Array.isArray(raw) || raw.length === 0) return { status: 'none' }

  const hit = raw[0] as NominatimHit
  const lat = parseFloat(hit.lat)
  const lng = parseFloat(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { status: 'none' }
  if (haversineKm([lng, lat], city.center) > GEOCODE_SANITY_RING_KM) {
    return { status: 'none' }
  }
  return { status: 'address', lat, lng, formatted: reading.address }
}

// ---------------------------------------------------------------------------
// Supabase (anon) — places and cities are public-read; no auth context needed.
// ---------------------------------------------------------------------------

let anonCached: SupabaseClient | null = null

function anonClient(): SupabaseClient | null {
  if (anonCached) return anonCached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  anonCached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return anonCached
}

const PLACE_COLUMNS = 'id, name, slug, address, lat, lng, city, location_slug'
const CANDIDATE_CAP = 500

async function fetchPlaceCandidates(
  filter: { locationSlug: string } | { country: string },
): Promise<LensResolvedPlace[]> {
  const supabase = anonClient()
  if (!supabase) return []
  let query = supabase
    .from('places')
    .select(PLACE_COLUMNS)
    .eq('status', 'active')
    .limit(CANDIDATE_CAP)
  query =
    'locationSlug' in filter
      ? query.eq('location_slug', filter.locationSlug)
      : query.ilike('country', filter.country)
  const { data, error } = await query
  if (error || !data) return []
  return data as unknown as LensResolvedPlace[]
}

// ---------------------------------------------------------------------------
// Stage D — duplicate detection. Candidates are keyed on exact date + location
// so both result sets are tiny; the title match runs in TS (no pg_trgm dep).
// ---------------------------------------------------------------------------

type DupFilter = { locationSlug: string } | { country: string }

function applyDupFilter<T extends { eq: (c: string, v: string) => T; ilike: (c: string, v: string) => T }>(
  query: T,
  filter: DupFilter,
): T {
  return 'locationSlug' in filter
    ? query.eq('location_slug', filter.locationSlug)
    : query.ilike('country', filter.country)
}

/**
 * Spec §Stage D. A published hit returns slug/title/date so the result card
 * can link the live page. A pending-submission hit returns 'in_review' and
 * NOTHING else — submissions are not public and must not leak through the
 * scanner. Never blocks: the caller shows a panel, Continue keeps working.
 */
async function detectDuplicate(
  reading: PosterReading,
  city: LensCityResolution,
): Promise<LensDuplicateResolution> {
  // No resolvable date = no reliable key; the queue stays the dedup authority.
  if (!reading.date) return { status: 'none' }

  const filter: DupFilter =
    city.status !== 'none' && city.slug
      ? { locationSlug: city.slug }
      : reading.country
        ? { country: reading.country }
        : { locationSlug: '__none__' } // matches nothing rather than the world

  // Published events — public-read, so the anon client is enough, and the
  // slug/title/date are allowed to reach the client.
  try {
    const supabase = anonClient()
    if (supabase) {
      let q = supabase
        .from('events')
        .select('slug, title, date')
        .eq('status', 'published')
        .eq('date', reading.date)
        .limit(50)
      q = applyDupFilter(q, filter)
      const { data } = await q
      const rows = (data ?? []) as Array<{ slug: string; title: string; date: string }>
      const hit = rows.find((r) => titlesMatch(reading.title, r.title))
      if (hit) {
        return { status: 'live', event: { slug: hit.slug, title: hit.title, date: hit.date } }
      }
    }
  } catch {
    // Live-dup lookup failed — fall through to the boolean submission check.
  }

  // Pending submissions — NOT public-read (RLS), so use the service client,
  // and return boolean-only. Titles are compared server-side and discarded;
  // no submission field ever crosses into the response.
  try {
    const admin = createAdminClient()
    let q = admin
      .from('event_submissions')
      .select('title')
      .eq('status', 'pending')
      .eq('date', reading.date)
      .limit(50)
    q = applyDupFilter(q as never, filter)
    const { data } = await q
    const rows = (data ?? []) as Array<{ title: string }>
    if (rows.some((r) => titlesMatch(reading.title, r.title))) {
      return { status: 'in_review' }
    }
  } catch {
    // Missing service key or query error — no submission signal, not fatal.
  }

  return { status: 'none' }
}

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

function cityFromOption(
  option: LocationOption,
  status: 'matched' | 'inherited',
): LensCityResolution {
  return {
    status,
    slug: option.slug,
    label: option.label,
    country: option.country,
    ...(option.region ? { region: option.region } : {}),
    center: option.center,
  }
}

function titleizeSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function resolvePoster(
  reading: PosterReading,
): Promise<LensResolution> {
  const options = await fetchLocations()

  // Stage A1 — local city match (exact folded / Albanian-stem equality only).
  let city: LensCityResolution | null = null
  if (reading.city) {
    const option = matchCityLocal(reading.city, options)
    if (option) city = cityFromOption(option, 'matched')
  }

  // Stage B — venue candidates scoped to the resolved city, or country-wide
  // when the city is unknown (enables Stage A2 inheritance).
  let venue: LensVenueResolution = { status: 'none' }
  if (reading.venue_name) {
    let candidates: LensResolvedPlace[] = []
    if (city) {
      candidates = await fetchPlaceCandidates({ locationSlug: city.slug })
    } else if (reading.country) {
      candidates = await fetchPlaceCandidates({ country: reading.country })
    }
    venue = matchVenueCandidates(reading.venue_name, candidates)
  }

  // Stage A2 — inherit the city from a strong venue match.
  if (!city && venue.status === 'matched' && venue.place) {
    const place = venue.place
    const option = options.find((o) => o.slug === place.location_slug)
    city = option
      ? cityFromOption(option, 'inherited')
      : {
          status: 'inherited',
          slug: place.location_slug,
          label: place.city || titleizeSlug(place.location_slug),
          country: reading.country,
          ...(place.lat != null && place.lng != null
            ? { center: [place.lng, place.lat] as [number, number] }
            : {}),
        }
  }

  // Stage A3 — remote fallback (Nominatim, country-agreement gated).
  if (!city && reading.city) {
    city = await resolveCityRemote(reading)
  }

  // Stage C — address geocode only when no venue was auto-linked.
  let geocode: LensGeocodeResolution = { status: 'none' }
  if (venue.status !== 'matched' && reading.address && city) {
    geocode = await geocodeAddress(reading, city)
  }

  const resolvedCity = city ?? NONE_CITY

  // Stage D — duplicate detection. Self-degrades to 'none' on any error so a
  // dedup failure never wipes out the city/venue resolution above.
  let duplicate: LensDuplicateResolution = { status: 'none' }
  try {
    duplicate = await detectDuplicate(reading, resolvedCity)
  } catch {
    duplicate = { status: 'none' }
  }

  return { city: resolvedCity, venue, geocode, duplicate }
}
