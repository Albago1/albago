import { NextResponse } from 'next/server'
import { readEventFromUrl } from '@/lib/ai/urlReader'
import { isPublicHttpUrl } from '@/lib/ssrfGuard'
import { hasStudioAccess } from '@/lib/ai/studioAccess'
import { scanLimited } from '@/lib/lens/scanLimiter'
import { resolveAndTranslate } from '@/lib/lens/enrich'

/**
 * AlbaGo Lens (LENS-4): POST an event URL, get the same structured reading a
 * poster photo would — then the shared resolution + translation layers.
 *
 * Gated like the Poster Studio (admins + profiles.studio_access); the shared
 * per-IP limit (one bucket across the scan routes) protects the free Gemini
 * quota and the outbound fetch.
 */

export const maxDuration = 60

const MIN_CONFIDENCE = 0.3

export async function POST(request: Request) {
  try {
    if (!(await hasStudioAccess())) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (scanLimited(ip)) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    let body: { url?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
    }

    if (typeof body.url !== 'string' || !body.url.trim()) {
      return NextResponse.json({ ok: false, error: 'no_url' }, { status: 400 })
    }
    // Structural SSRF check up front; safeFetch re-validates DNS + each hop.
    const url = isPublicHttpUrl(body.url.trim())
    if (!url) {
      return NextResponse.json({ ok: false, error: 'bad_url' }, { status: 400 })
    }

    const todayIso = new Date().toISOString().slice(0, 10)

    let result
    try {
      result = await readEventFromUrl(url.toString(), todayIso)
    } catch (error) {
      console.error('[lens/url] extraction failed:', error)
      return NextResponse.json({ ok: false, error: 'unreadable' }, { status: 502 })
    }

    if (!result) {
      // Fetch blocked/login-walled/JS-only, or no event on the page.
      return NextResponse.json({ ok: false, error: 'unreadable' }, { status: 422 })
    }

    const { reading, imageUrl } = result
    if (!reading.is_event || !reading.title || reading.confidence < MIN_CONFIDENCE) {
      return NextResponse.json({ ok: false, error: 'not_an_event' }, { status: 422 })
    }

    const { resolution, translation } = await resolveAndTranslate(reading, 'lens/url')

    return NextResponse.json({ ok: true, reading, resolution, translation, imageUrl })
  } catch (error) {
    console.error('[lens/url] unexpected error:', error)
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })
  }
}
