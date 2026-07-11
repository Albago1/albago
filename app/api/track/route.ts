import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * First-party interaction tracking endpoint.
 *
 * Design:
 *   - Inserts go through the service role (bypasses RLS); the interactions
 *     table has NO insert policies, so this route is the only write path.
 *   - PII-free by construction: no IP stored, no user id, anonymous
 *     session_id only. IP is used transiently for rate limiting.
 *   - Must never break a user flow: invalid payloads get a quiet 4xx,
 *     server hiccups get a quiet 5xx, and the client ignores both.
 */

export const runtime = 'nodejs'
export const revalidate = 0

const ALLOWED_TYPES = new Set([
  'event_view',
  'protest_view',
  'place_view',
  'placard_view',
  'placard_download',
  'share_click',
  'city_search',
  'search_query',
  'submit_started',
  'submit_completed',
  'calendar_add',
  'subscribe',
  'outbound_click',
  'lens_scan',
  'lens_apply',
  'lens_resolved',
])

const ALLOWED_ENTITY_TYPES = new Set(['event', 'place', 'placard', 'submission'])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MAX_BODY_BYTES = 4096
const MAX_METADATA_CHARS = 2000

// -- In-memory rate limit (per instance, same trade-off as /api/geocode) ----
const RATE_WINDOW_MS = 60_000
const RATE_MAX_PER_WINDOW = 120
const RATE_MAP_MAX = 5000

type RateEntry = { windowStart: number; count: number }
const rateMap = new Map<string, RateEntry>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    if (rateMap.size >= RATE_MAP_MAX) {
      const oldestKey = rateMap.keys().next().value
      if (oldestKey) rateMap.delete(oldestKey)
    }
    rateMap.set(ip, { windowStart: now, count: 1 })
    return false
  }
  entry.count += 1
  return entry.count > RATE_MAX_PER_WINDOW
}

// -- Field sanitizers --------------------------------------------------------

function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function uuidOrNull(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null
}

function metadataOrEmpty(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  try {
    return JSON.stringify(value).length <= MAX_METADATA_CHARS
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

// -- Handler -----------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (rateLimited(ip)) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 })
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
    }

    const type = str(payload.type, 40)
    const sessionId = uuidOrNull(payload.session_id)
    if (!type || !ALLOWED_TYPES.has(type) || !sessionId) {
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
    }

    const entityType = str(payload.entity_type, 20)
    const row = {
      type,
      entity_type:
        entityType && ALLOWED_ENTITY_TYPES.has(entityType) ? entityType : null,
      entity_id: uuidOrNull(payload.entity_id),
      city: str(payload.city, 120),
      country: str(payload.country, 120),
      platform: str(payload.platform, 60),
      source: str(payload.source, 120),
      utm_source: str(payload.utm_source, 120),
      utm_medium: str(payload.utm_medium, 120),
      utm_campaign: str(payload.utm_campaign, 160),
      path: str(payload.path, 300),
      referrer: str(payload.referrer, 300),
      session_id: sessionId,
      metadata: metadataOrEmpty(payload.metadata),
    }

    const supabase = createAdminClient()
    // The shared admin client carries no generated DB types; insert params
    // resolve to `never` without this cast.
    const { error } = await supabase.from('interactions').insert(row as never)
    if (error) {
      console.error('track insert failed:', error.message)
      return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('track route error:', err)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}
