// Unified search engine for the /map surface — the ranking, matching,
// recent-search memory, and worldwide city geocoding behind the search
// experience. Pure logic only; the UI lives in components/map/MapSearch.tsx.

export type MapSearchCity = {
  slug: string
  label: string
  country: string
  center?: [number, number]
}

export type MapSearchEventRow = {
  id: string
  title: string
  sub: string
  category: string
  center: [number, number]
}

export type MapSearchPlaceRow = {
  id: string
  name: string
  sub: string
  center: [number, number]
}

export type MapSearchIndex = {
  cities: MapSearchCity[]
  events: MapSearchEventRow[]
  places: MapSearchPlaceRow[]
}

// Accent-insensitive fold that PRESERVES string length, so match positions
// on the folded string can be used to highlight the original: each character
// folds independently to its base letter ("ë" → "e", "Ç" → "c"). The plain
// multi-char fold() used elsewhere can shift indices via NFD expansion.
const foldCharCache = new Map<string, string>()

function foldChar(ch: string): string {
  let folded = foldCharCache.get(ch)
  if (folded === undefined) {
    folded =
      ch
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')[0] ?? ch.toLowerCase()
    foldCharCache.set(ch, folded)
  }
  return folded
}

export function foldText(value: string): string {
  let out = ''
  for (const ch of value) out += foldChar(ch)
  return out
}

export function tokenizeQuery(query: string): string[] {
  return foldText(query.trim()).split(/\s+/).filter(Boolean)
}

// Search-engine-style ranking. Every token must match somewhere in the
// primary or secondary text (AND semantics — "protest berlin" needs both);
// the score rewards WHERE it matches: whole-field > field prefix >
// word-boundary > mid-word, with secondary-field hits worth half. Returns 0
// when any token misses.
export function matchScore(
  tokens: string[],
  primary: string,
  secondary = '',
): number {
  if (tokens.length === 0) return 0
  const p = foldText(primary)
  const s = foldText(secondary)
  let total = 0
  for (const token of tokens) {
    const pIdx = p.indexOf(token)
    if (pIdx !== -1) {
      if (p === token) total += 100
      else if (pIdx === 0) total += 80
      else if (/[^a-z0-9]/.test(p[pIdx - 1])) total += 60
      else total += 25
      continue
    }
    const sIdx = s.indexOf(token)
    if (sIdx === -1) return 0
    if (sIdx === 0) total += 40
    else if (/[^a-z0-9]/.test(s[sIdx - 1])) total += 30
    else total += 12
  }
  return total
}

export type HighlightSegment = { text: string; hit: boolean }

// Split `text` into segments marking the folded-match ranges of each token,
// so the UI can bold exactly what the user typed — including across accents
// ("tira" bolds "Tira" in "Tiranë").
export function highlightSegments(
  text: string,
  tokens: string[],
): HighlightSegment[] {
  const folded = foldText(text)
  const hits = new Array<boolean>(text.length).fill(false)
  for (const token of tokens) {
    const idx = folded.indexOf(token)
    if (idx === -1) continue
    for (let i = idx; i < Math.min(idx + token.length, text.length); i++) {
      hits[i] = true
    }
  }
  const segments: HighlightSegment[] = []
  for (let i = 0; i < text.length; i++) {
    const last = segments[segments.length - 1]
    if (last && last.hit === hits[i]) last.text += text[i]
    else segments.push({ text: text[i], hit: hits[i] })
  }
  return segments
}

// ---------------------------------------------------------------------------
// Recent searches — the memory every serious search box has. Stored locally,
// newest first, deduped, capped.

export type RecentSearch =
  | { kind: 'city'; slug: string; label: string; sub: string; center?: [number, number] }
  | { kind: 'event'; id: string; label: string; sub: string; category: string; center: [number, number] }
  | { kind: 'place'; id: string; label: string; sub: string; center: [number, number] }
  | { kind: 'query'; label: string }

const RECENT_KEY = 'albago:map-recent-searches'
const RECENT_MAX = 8

function recentIdentity(entry: RecentSearch): string {
  if (entry.kind === 'city') return `city:${entry.slug}`
  if (entry.kind === 'query') return `query:${foldText(entry.label)}`
  return `${entry.kind}:${entry.id}`
}

export function readRecentSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry): entry is RecentSearch =>
          !!entry &&
          typeof entry === 'object' &&
          typeof entry.label === 'string' &&
          ['city', 'event', 'place', 'query'].includes(entry.kind),
      )
      .slice(0, RECENT_MAX)
  } catch {
    return []
  }
}

export function pushRecentSearch(entry: RecentSearch): RecentSearch[] {
  const id = recentIdentity(entry)
  const next = [
    entry,
    ...readRecentSearches().filter((e) => recentIdentity(e) !== id),
  ].slice(0, RECENT_MAX)
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Storage full / privacy mode — recents just don't persist.
  }
  return next
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY)
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Worldwide city coverage — when the local city list has no strong match,
// the search falls through to Nominatim so ANY city on earth resolves,
// exactly like the big platforms. Same endpoint + mapping the location
// pickers already use (CitySearchInput).

export type RemoteCity = {
  slug: string
  label: string
  country: string
  center: [number, number]
  displayName: string
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

export async function searchRemoteCities(
  query: string,
  signal: AbortSignal,
): Promise<RemoteCity[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=4&addressdetails=1`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  const hits = (await res.json()) as NominatimHit[]
  if (!Array.isArray(hits)) return []
  return hits.map((hit) => {
    const a = hit.address ?? {}
    const city = a.city || a.town || a.village || a.municipality || ''
    const label = city || hit.display_name.split(',')[0]?.trim() || hit.display_name
    return {
      slug: slugifyCityName(city || label) || 'unknown',
      label,
      country: a.country ?? '',
      center: [parseFloat(hit.lon), parseFloat(hit.lat)] as [number, number],
      displayName: hit.display_name,
    }
  })
}
