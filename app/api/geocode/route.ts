import { NextResponse } from 'next/server'

/**
 * Server-side proxy for OpenStreetMap Nominatim.
 *
 * Why a proxy:
 *   - Nominatim's usage policy requires a custom User-Agent header. The
 *     browser can't set User-Agent on fetch, so calling Nominatim directly
 *     from the client is technically against policy.
 *   - We can add a small in-memory LRU cache to reduce hits.
 *   - One choke point if we ever switch geocoders (Mapbox, Photon, etc.).
 *
 * Forward search: GET /api/geocode?q=Brandenburg+Gate&limit=5
 * Reverse:        GET /api/geocode?reverse=1&lat=52.5&lng=13.4
 */

export const runtime = 'nodejs'
export const revalidate = 0

const USER_AGENT = 'AlbaGo/1.0 (contact: gerard.gani2007@gmail.com)'
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

type Suggestion = {
  slug: string
  city: string | null
  country: string | null
  countryCode: string | null
  region: string | null
  address: string | null
  road: string | null
  houseNumber: string | null
  postcode: string | null
  displayName: string
  lat: number
  lng: number
  placeId: number | string
  importance: number | null
  type: string | null
}

type NominatimHit = {
  place_id?: number | string
  lat: string
  lon: string
  display_name: string
  importance?: number
  type?: string
  class?: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    state?: string
    county?: string
    country?: string
    country_code?: string
    road?: string
    house_number?: string
    postcode?: string
  }
}

function slugify(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function hitToSuggestion(hit: NominatimHit): Suggestion {
  const a = hit.address ?? {}
  const city = a.city || a.town || a.village || a.municipality || null
  const country = a.country || null
  const cityForSlug = city || hit.display_name.split(',')[0]?.trim() || 'unknown'
  const addressParts = [a.house_number, a.road].filter(Boolean).join(' ')

  return {
    slug: slugify(cityForSlug) || 'unknown',
    city: city,
    country: country,
    countryCode: a.country_code ? a.country_code.toUpperCase() : null,
    region: a.state || a.county || null,
    address: addressParts || null,
    road: a.road || null,
    houseNumber: a.house_number || null,
    postcode: a.postcode || null,
    displayName: hit.display_name,
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    placeId: hit.place_id ?? hit.display_name,
    importance: hit.importance ?? null,
    type: hit.type ?? hit.class ?? null,
  }
}

// -- In-memory LRU cache ----------------------------------------------------
// Cold-start safe but not persistent across invocations on a new Vercel
// instance. Good enough to dedupe within a single user session.

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const CACHE_MAX = 500

type CacheEntry = { at: number; value: unknown }
const cache = new Map<string, CacheEntry>()

function cacheGet(key: string): unknown | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  // Refresh LRU position.
  cache.delete(key)
  cache.set(key, entry)
  return entry.value
}

function cacheSet(key: string, value: unknown) {
  if (cache.size >= CACHE_MAX) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(key, { at: Date.now(), value })
}

// -- Handler ---------------------------------------------------------------

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reverse = url.searchParams.get('reverse')
  const limitRaw = url.searchParams.get('limit')
  const limit = Math.max(1, Math.min(10, parseInt(limitRaw ?? '5', 10) || 5))

  try {
    if (reverse === '1') {
      const lat = url.searchParams.get('lat')
      const lng = url.searchParams.get('lng')
      if (!lat || !lng) {
        return NextResponse.json(
          { error: 'lat and lng required for reverse geocoding' },
          { status: 400 },
        )
      }
      const cacheKey = `r:${lat}:${lng}`
      const cached = cacheGet(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }

      const res = await fetch(
        `${NOMINATIM_BASE}/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&addressdetails=1`,
        {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          cache: 'no-store',
        },
      )
      if (!res.ok) {
        return NextResponse.json(
          { error: 'nominatim_failed', status: res.status },
          { status: 502 },
        )
      }
      const data = (await res.json()) as NominatimHit
      const result = data && data.lat ? hitToSuggestion(data) : null
      const payload = { result }
      cacheSet(cacheKey, payload)
      return NextResponse.json(payload)
    }

    const q = (url.searchParams.get('q') ?? '').trim()
    if (q.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    const cacheKey = `f:${q.toLowerCase()}:${limit}`
    const cached = cacheGet(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const res = await fetch(
      `${NOMINATIM_BASE}/search?q=${encodeURIComponent(q)}&format=json&limit=${limit}&addressdetails=1`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        cache: 'no-store',
      },
    )
    if (!res.ok) {
      return NextResponse.json(
        { error: 'nominatim_failed', status: res.status, suggestions: [] },
        { status: 502 },
      )
    }
    const data = (await res.json()) as NominatimHit[]
    const suggestions = Array.isArray(data) ? data.map(hitToSuggestion) : []
    const payload = { suggestions }
    cacheSet(cacheKey, payload)
    return NextResponse.json(payload)
  } catch (err) {
    console.error('geocode route error:', err)
    return NextResponse.json(
      { error: 'internal_error', suggestions: [] },
      { status: 500 },
    )
  }
}
