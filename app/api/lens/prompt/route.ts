import { NextResponse } from 'next/server'
import { readEventFromPrompt } from '@/lib/ai/promptReader'
import { scanLimited } from '@/lib/lens/scanLimiter'
import { resolveAndTranslate } from '@/lib/lens/enrich'

/**
 * AlbaGo Lens (task U-01): POST a free-text event description, get the same
 * structured reading a poster photo or URL would — then the shared
 * resolution + translation layers. Draft only: the client routes the result
 * into the wizard where the user reviews before anything is submitted.
 *
 * Shares the per-IP scan bucket with the photo and URL routes so the three
 * entry points together respect the free Gemini quota.
 */

export const maxDuration = 60

const MIN_CONFIDENCE = 0.3
const MIN_TEXT_CHARS = 12

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (scanLimited(ip)) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    let body: { text?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
    }

    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (text.length < MIN_TEXT_CHARS) {
      return NextResponse.json({ ok: false, error: 'no_text' }, { status: 400 })
    }

    const todayIso = new Date().toISOString().slice(0, 10)

    let reading
    try {
      reading = await readEventFromPrompt(text, todayIso)
    } catch (error) {
      console.error('[lens/prompt] extraction failed:', error)
      return NextResponse.json({ ok: false, error: 'unreadable' }, { status: 502 })
    }

    if (
      !reading ||
      !reading.is_event ||
      !reading.title ||
      reading.confidence < MIN_CONFIDENCE
    ) {
      return NextResponse.json({ ok: false, error: 'not_an_event' }, { status: 422 })
    }

    const { resolution, translation } = await resolveAndTranslate(reading, 'lens/prompt')

    return NextResponse.json({
      ok: true,
      reading,
      resolution,
      translation,
      imageUrl: null,
    })
  } catch (error) {
    console.error('[lens/prompt] unexpected error:', error)
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })
  }
}
