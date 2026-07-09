import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLocationBySlug } from '@/lib/locations'
import {
  craftPosterPrompt,
  type PosterEventContext,
} from '@/lib/ai/posterArtDirection'

/**
 * AI poster backdrop generation.
 *
 * Design:
 *   - One backdrop per event, generated on first request and cached forever
 *     in the public `ai-posters` storage bucket ({slug}.png). Every later
 *     request — from anyone — is a cache hit that costs nothing.
 *   - The image is atmosphere only; share templates typeset the event info
 *     on top. See lib/ai/posterArtDirection.ts.
 *   - Cost exposure is bounded: at most one image per published event, plus
 *     a per-IP limit on the expensive generation path.
 *   - To force a regeneration, delete ai-posters/{slug}.png in Supabase
 *     Storage and share again.
 */

export const runtime = 'nodejs'
export const maxDuration = 120

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/i

// Pollinations — free, keyless image generation. Gemini's free tier serves
// text only (image models are limit:0 since Dec 2025), so prompt crafting
// stays on the free Gemini key while the painting happens here. Random seed
// so deleting a cached poster and regenerating gives fresh art.
const IMAGE_MODEL = process.env.AI_POSTER_IMAGE_MODEL || 'flux'

async function paintBackdrop(prompt: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const seed = Math.floor(Math.random() * 1_000_000)
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=1080&height=1920&model=${IMAGE_MODEL}&nologo=true&seed=${seed}&referrer=albago.org`
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) })
  const contentType = res.headers.get('content-type') || ''
  if (!res.ok || !contentType.startsWith('image/')) {
    throw new Error(`pollinations responded ${res.status} ${contentType}`)
  }
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType }
}

// -- In-memory rate limits (per instance, same trade-off as /api/track) ------
// Cheap path (cache hits): generous. Generation path: tight — each miss
// costs real money on the image model.
const CHEAP_WINDOW_MS = 60_000
const CHEAP_MAX = 30
const GEN_WINDOW_MS = 10 * 60_000
const GEN_MAX = 5
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

function publicPosterUrl(slug: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ai-posters/${slug}.jpg`
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (limited(cheapMap, ip, CHEAP_WINDOW_MS, CHEAP_MAX)) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    let payload: { slug?: unknown }
    try {
      payload = (await request.json()) as { slug?: unknown }
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
    }

    const slug = typeof payload.slug === 'string' ? payload.slug.toLowerCase() : ''
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ ok: false, error: 'invalid_slug' }, { status: 400 })
    }

    // Cache hit — the poster already exists for everyone.
    const url = publicPosterUrl(slug)
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    if (head.ok) {
      return NextResponse.json({ ok: true, url, cached: true })
    }

    // Generation path from here — tight limit.
    if (limited(genMap, ip, GEN_WINDOW_MS, GEN_MAX)) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    const supabase = createAdminClient()
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(
        'title, description, category, location_slug, country, is_civic, tags, banner_url, gallery_urls, address_hint, date, time, expected_attendees, organizer_name, places ( name )',
      )
      .eq('status', 'published')
      .eq('slug', slug)
      .maybeSingle()
    if (eventError) {
      console.error('ai-poster event fetch failed:', eventError.message)
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
      banner_url: string | null
      gallery_urls: string[] | null
      address_hint: string | null
      date: string | null
      time: string | null
      expected_attendees: number | null
      organizer_name: string | null
      places: { name: string | null } | null
    }

    // getLocationBySlug falls back to Tirana for unknown slugs — prefer the
    // raw slug prettified over a wrong city in the artwork.
    const location = getLocationBySlug(row.location_slug)
    const city =
      location.slug === row.location_slug
        ? location.label
        : (row.location_slug || 'the city').replace(/-/g, ' ')

    const imageUrls = [row.banner_url, ...(row.gallery_urls ?? [])].filter(
      (u): u is string => typeof u === 'string' && /^https?:\/\//.test(u),
    )

    const context: PosterEventContext = {
      title: row.title,
      description: row.description,
      category: row.category,
      city,
      country: row.country,
      isCivic: Boolean(row.is_civic),
      tags: row.tags,
      venueName: row.places?.name ?? null,
      addressHint: row.address_hint,
      date: row.date,
      time: row.time,
      expectedAttendees: row.expected_attendees,
      organizerName: row.organizer_name,
      imageUrls,
    }

    const prompt = await craftPosterPrompt(context)

    const { bytes, contentType } = await paintBackdrop(prompt)

    const { error: uploadError } = await supabase.storage
      .from('ai-posters')
      .upload(`${slug}.jpg`, bytes, {
        contentType,
        upsert: true,
      })
    if (uploadError) {
      console.error('ai-poster upload failed:', uploadError.message)
      return NextResponse.json({ ok: false, error: 'upload_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, url, cached: false })
  } catch (err) {
    console.error('ai-poster route error:', err)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}
