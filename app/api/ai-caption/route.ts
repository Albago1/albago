import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasStudioAccess } from '@/lib/ai/studioAccess'
import { getLocationBySlug } from '@/lib/locations'
import {
  craftCaptionPack,
  type CaptionEventContext,
  type CaptionPack,
} from '@/lib/ai/captionWriter'

/**
 * AI share captions — same architecture as /api/ai-poster:
 *   - One caption pack (en/sq/de/es) per event, generated on first Studio
 *     request and cached forever as {slug}.captions.json in the public
 *     ai-posters bucket. Reads are free for everyone.
 *   - Creation is Studio-gated (admins + granted accounts).
 *   - regenerate:true skips the cache and overwrites.
 */

export const runtime = 'nodejs'
export const maxDuration = 60

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/i

const CHEAP_WINDOW_MS = 60_000
const CHEAP_MAX = 30
const GEN_WINDOW_MS = 10 * 60_000
const GEN_MAX = 10
const RATE_MAP_MAX = 5000

type RateEntry = { windowStart: number; count: number }
const cheapMap = new Map<string, RateEntry>()
const genMap = new Map<string, RateEntry>()

function limited(map: Map<string, RateEntry>, ip: string, windowMs: number, max: number): boolean {
  const now = Date.now()
  const entry = map.get(ip)
  if (!entry || now - entry.windowStart > windowMs) {
    if (map.size >= RATE_MAP_MAX) {
      const oldestKey = map.keys().next().value
      if (oldestKey) map.delete(oldestKey)
    }
    map.set(ip, { windowStart: now, count: 1 })
    return false
  }
  entry.count += 1
  return entry.count > max
}

function captionsUrl(slug: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ai-posters/${slug}.captions.json`
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (limited(cheapMap, ip, CHEAP_WINDOW_MS, CHEAP_MAX)) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    let payload: { slug?: unknown; regenerate?: unknown }
    try {
      payload = (await request.json()) as { slug?: unknown; regenerate?: unknown }
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
    }

    const slug = typeof payload.slug === 'string' ? payload.slug.toLowerCase() : ''
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ ok: false, error: 'invalid_slug' }, { status: 400 })
    }
    const regenerate = payload.regenerate === true

    if (!regenerate) {
      const cached = await fetch(captionsUrl(slug), { cache: 'no-store' })
      if (cached.ok) {
        const captions = (await cached.json()) as CaptionPack
        return NextResponse.json({ ok: true, captions, cached: true })
      }
    }

    if (!(await hasStudioAccess())) {
      return NextResponse.json({ ok: false, error: 'studio_required' }, { status: 403 })
    }
    if (limited(genMap, ip, GEN_WINDOW_MS, GEN_MAX)) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    const supabase = createAdminClient()
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(
        'title, description, category, location_slug, country, is_civic, tags, address, date, time, end_time, organizer_name, places ( name )',
      )
      .eq('status', 'published')
      .eq('slug', slug)
      .maybeSingle()
    if (eventError) {
      console.error('ai-caption event fetch failed:', eventError.message)
      return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
    }
    if (!event) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }

    const row = event as {
      title: string
      description: string | null
      category: string | null
      location_slug: string | null
      country: string | null
      is_civic: boolean | null
      tags: string[] | null
      address: string | null
      date: string
      time: string | null
      end_time: string | null
      organizer_name: string | null
      places: { name: string | null } | null
    }

    const location = getLocationBySlug(row.location_slug)
    const city =
      location.slug === row.location_slug
        ? location.label
        : (row.location_slug || 'the city').replace(/-/g, ' ')

    const context: CaptionEventContext = {
      title: row.title,
      description: row.description,
      category: row.category,
      city,
      country: row.country,
      isCivic: Boolean(row.is_civic),
      tags: row.tags,
      venueName: row.places?.name ?? null,
      address: row.address,
      date: row.date,
      time: row.time,
      endTime: row.end_time,
      organizerName: row.organizer_name,
      eventUrl: `https://albago.org/events/${slug}`,
    }

    const captions = await craftCaptionPack(context)
    if (!captions) {
      return NextResponse.json({ ok: false, error: 'generation_failed' }, { status: 502 })
    }

    const { error: uploadError } = await supabase.storage
      .from('ai-posters')
      .upload(`${slug}.captions.json`, JSON.stringify(captions), {
        contentType: 'application/json',
        upsert: true,
      })
    if (uploadError) {
      console.error('ai-caption upload failed:', uploadError.message)
      return NextResponse.json({ ok: false, error: 'upload_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, captions, cached: false })
  } catch (err) {
    console.error('ai-caption route error:', err)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}
