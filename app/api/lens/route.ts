import { NextResponse } from 'next/server'
import { readPosterImage } from '@/lib/ai/posterReader'
import { hasStudioAccess } from '@/lib/ai/studioAccess'
import { scanLimited } from '@/lib/lens/scanLimiter'
import { resolveAndTranslate } from '@/lib/lens/enrich'

/**
 * AlbaGo Lens (LENS-1): POST a poster photo, get a structured event reading.
 *
 * Gated like the Poster Studio (admins + profiles.studio_access) while the
 * platform grows — Lens is a differentiator we don't want copied early.
 * The per-IP limit protects the free Gemini quota.
 *
 * Client sends multipart/form-data with an `image` file (downscaled to
 * ≤1600px JPEG on the client before upload).
 */

export const maxDuration = 60

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// Low-confidence readings still return (the user reviews every field in the
// wizard anyway); below this floor the model is effectively guessing.
const MIN_CONFIDENCE = 0.3

export async function POST(request: Request) {
  try {
    if (!(await hasStudioAccess())) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (scanLimited(ip)) {
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

    let scan
    try {
      scan = await readPosterImage(bytes, todayIso, file.type)
    } catch (error) {
      console.error('[lens] extraction failed:', error)
      return NextResponse.json(
        { ok: false, error: 'unreadable' },
        { status: 500 },
      )
    }

    if (!scan) {
      return NextResponse.json(
        { ok: false, error: 'unreadable' },
        { status: 500 },
      )
    }
    const { reading, regions } = scan
    if (!reading.is_event || !reading.title || reading.confidence < MIN_CONFIDENCE) {
      return NextResponse.json(
        { ok: false, error: 'not_a_poster' },
        { status: 422 },
      )
    }

    // LENS-2 resolution + LENS-3 translation in parallel, both fail-open.
    const { resolution, translation } = await resolveAndTranslate(reading, 'lens')

    // `regions` powers the scan-theater reveal on the client; null = no theater.
    return NextResponse.json({ ok: true, reading, resolution, translation, regions })
  } catch (error) {
    console.error('[lens] unexpected error:', error)
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })
  }
}
