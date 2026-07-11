import { NextResponse } from 'next/server'
import { readPosterImage } from '@/lib/ai/posterReader'
import { resolvePoster, type LensResolution } from '@/lib/lens/resolve'

/**
 * AlbaGo Lens (LENS-1): POST a poster photo, get a structured event reading.
 *
 * Open to signed-out users on purpose — the submit flow itself is
 * "start now, sign in later", and the auth gate still guards actual
 * submission. The per-IP limit protects the free Gemini quota.
 *
 * Client sends multipart/form-data with an `image` file (downscaled to
 * ≤1600px JPEG on the client before upload).
 */

export const maxDuration = 60

const SCAN_WINDOW_MS = 10 * 60_000
const SCAN_MAX = 10
const RATE_MAP_MAX = 5000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// Low-confidence readings still return (the user reviews every field in the
// wizard anyway); below this floor the model is effectively guessing.
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

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (limited(ip)) {
      return NextResponse.json(
        { ok: false, error: 'rate_limited' },
        { status: 429 },
      )
    }

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json(
        { ok: false, error: 'invalid_request' },
        { status: 400 },
      )
    }

    const file = form.get('image')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: 'no_image' },
        { status: 400 },
      )
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: 'unsupported_type' },
        { status: 400 },
      )
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'too_large' },
        { status: 400 },
      )
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const todayIso = new Date().toISOString().slice(0, 10)

    let reading
    try {
      reading = await readPosterImage(bytes, todayIso, file.type)
    } catch (error) {
      console.error('[lens] extraction failed:', error)
      return NextResponse.json(
        { ok: false, error: 'unreadable' },
        { status: 500 },
      )
    }

    if (!reading) {
      return NextResponse.json(
        { ok: false, error: 'unreadable' },
        { status: 500 },
      )
    }
    if (!reading.is_event || !reading.title || reading.confidence < MIN_CONFIDENCE) {
      return NextResponse.json(
        { ok: false, error: 'not_a_poster' },
        { status: 422 },
      )
    }

    // LENS-2 resolution layer. Fail-open by contract: any error here degrades
    // to the LENS-1 reading-only response — the scan must never fail because
    // venue/city resolution broke.
    let resolution: LensResolution | null = null
    try {
      resolution = await resolvePoster(reading)
    } catch (error) {
      console.error('[lens] resolution failed (non-fatal):', error)
      resolution = null
    }

    return NextResponse.json({ ok: true, reading, resolution })
  } catch (error) {
    console.error('[lens] unexpected error:', error)
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })
  }
}
