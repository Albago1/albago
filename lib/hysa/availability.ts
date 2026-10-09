import 'server-only'
import { CATEGORIES, OFFICIAL_SHOP_URL, type CategoryId } from './event'

// Ticket availability for the Team Hysa page (phase 44).
//
// The official Hysa ticket shop has no public API, sits behind bot
// protection and a waiting room, and its robots.txt disallows the shop —
// so AlbaGo does NOT fetch or scrape it. This module only reads an
// OFFICIAL feed if one is ever provided (HYSA_AVAILABILITY_FEED_URL, e.g.
// a JSON export from the ticketing partner). Without it the page shows
// "availability is checked in the official system".
//
// Feed contract (JSON): { categories: [{ id: "cat4"|"cat6"|"cat8",
//   price?: number (euros), availability: "available"|"limited"|"sold_out",
//   availableCount?: number, blocks?: string[] }], updatedAt?: ISO string }

export type AvailabilityLevel = 'available' | 'limited' | 'sold_out' | 'unknown'

export type CategoryAvailability = {
  id: CategoryId
  name: string
  price: number | null
  currency: 'EUR'
  availability: AvailabilityLevel
  availableCount: number | null
  blocks: string[]
  officialUrl: string
}

export type Availability = {
  eventId: 'kabayel-hysa-2026-11-28'
  status: 'live' | 'stale' | 'not_configured' | 'unavailable'
  /** When the data was last fetched from the official feed (ISO), if ever. */
  lastUpdated: string | null
  categories: CategoryAvailability[]
}

const TTL_MS = 60_000 // serve from memory for a minute
const STALE_MAX_MS = 15 * 60_000 // after a failed refresh, keep showing (as stale) for 15 min
const TIMEOUT_MS = 5_000

let cache: { at: number; data: Availability } | null = null
let inFlight: Promise<Availability> | null = null

const LEVELS = new Set<AvailabilityLevel>(['available', 'limited', 'sold_out'])

function empty(status: Availability['status']): Availability {
  return {
    eventId: 'kabayel-hysa-2026-11-28',
    status,
    lastUpdated: null,
    categories: CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      price: null,
      currency: 'EUR',
      availability: 'unknown',
      availableCount: null,
      blocks: [],
      officialUrl: OFFICIAL_SHOP_URL,
    })),
  }
}

/** Validate an official feed payload into the normalized shape. */
export function normalizeFeed(raw: unknown, fetchedAt: Date): Availability | null {
  if (!raw || typeof raw !== 'object') return null
  const list = (raw as { categories?: unknown }).categories
  if (!Array.isArray(list)) return null
  const byId = new Map<string, Record<string, unknown>>()
  for (const item of list) {
    if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
      byId.set((item as { id: string }).id, item as Record<string, unknown>)
    }
  }
  const base = empty('live')
  base.lastUpdated = fetchedAt.toISOString()
  base.categories = base.categories.map((c) => {
    const item = byId.get(c.id)
    if (!item) return c
    const level = item.availability
    const price = item.price
    const count = item.availableCount
    const blocks = item.blocks
    return {
      ...c,
      availability: typeof level === 'string' && LEVELS.has(level as AvailabilityLevel) ? (level as AvailabilityLevel) : 'unknown',
      price: typeof price === 'number' && price > 0 && price < 10_000 ? price : null,
      availableCount: typeof count === 'number' && count >= 0 ? Math.floor(count) : null,
      blocks: Array.isArray(blocks) ? blocks.filter((b): b is string => typeof b === 'string').slice(0, 40) : [],
    }
  })
  return base
}

async function fetchFeed(url: string): Promise<Availability> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`feed ${res.status}`)
    const data = normalizeFeed(await res.json(), new Date())
    if (!data) throw new Error('feed shape')
    return data
  } finally {
    clearTimeout(timer)
  }
}

export async function getAvailability(): Promise<Availability> {
  const url = process.env.HYSA_AVAILABILITY_FEED_URL
  if (!url) return empty('not_configured')

  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return cache.data
  // One refresh at a time — never hammer the source.
  if (!inFlight) {
    inFlight = fetchFeed(url)
      .then((data) => {
        cache = { at: Date.now(), data }
        return data
      })
      .catch((err) => {
        console.error('hysa availability feed failed:', err instanceof Error ? err.message : err)
        if (cache && Date.now() - cache.at < STALE_MAX_MS) {
          return { ...cache.data, status: 'stale' as const }
        }
        return empty('unavailable')
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}
