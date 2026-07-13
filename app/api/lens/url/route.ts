import { NextResponse } from 'next/server'
import { readEventFromUrl } from '@/lib/ai/urlReader'
import { resolvePoster, type LensResolution } from '@/lib/lens/resolve'
import { translateEventText, type EventTranslation } from '@/lib/ai/translateEvent'

/**
 * AlbaGo Lens (LENS-4): POST an event URL, get the same structured reading a
 * poster photo would — then the shared resolution + translation layers.
 *
 * Open to signed-out users like the photo scanner; the per-IP limit protects
 * the free Gemini quota and the outbound fetch.
 */

export const maxDuration = 60

const SCAN_WINDOW_MS = 10 * 60_000
const SCAN_MAX = 10
const RATE_MAP_MAX = 5000
const MIN_CONFIDENCE = 0.3

type RateEntry = { windowStart: number; count: number }
const scanMap = new Map<string, RateEntry>()

function limited(ip: string): boolean {
  const now = Date.now()
  const entry = scanMap.get(ip)
  if (!entry || now - entry.windowStart > SCAN_WINDOW_MS) {
    if (scanMap.size >= RATE_MAP_MAX) {
      const oldestKey = scanMap.keys().next().value
      if (oldestKey) scanMap.delete(oldestKey)
    }
    scanMap.set(ip, { windowStart: now, count: 1 })
    return false
  }
  entry.count += 1
  return entry.count > SCAN_MAX
}

/** Only http(s), and never let the server be pointed at internal hosts (SSRF). */
function isPublicHttpUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '[::1]'
  ) {
    return null
  }
  return url
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (limited(ip)) {
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

    // Shared LENS-2 resolution + LENS-3 translation, both fail-open.
    const [resolutionResult, translationResult] = await Promise.allSettled([
      resolvePoster(reading),
      translateEventText({
        title: reading.title,
        description: reading.description,
        sourceLanguage: reading.language,
      }),
    ])

    let resolution: LensResolution | null = null
    if (resolutionResult.status === 'fulfilled') resolution = resolutionResult.value
    else console.error('[lens/url] resolution failed (non-fatal):', resolutionResult.reason)

    let translation: EventTranslation | null = null
    if (translationResult.status === 'fulfilled') translation = translationResult.value
    else console.error('[lens/url] translation failed (non-fatal):', translationResult.reason)

    return NextResponse.json({ ok: true, reading, resolution, translation, imageUrl })
  } catch (error) {
    console.error('[lens/url] unexpected error:', error)
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })
  }
}
