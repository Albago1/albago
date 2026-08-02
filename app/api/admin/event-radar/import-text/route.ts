import { NextResponse } from 'next/server'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import { importFromText } from '@/lib/radar/service'

/**
 * Event Radar: import a block of PASTED text (an events list copied from
 * ChatGPT, an email, a PDF) into the one candidate queue. No fetching — the
 * human already gathered the text, so this works where JS-walled/login sites
 * yield nothing to the crawler. Admin session required. Nothing is published;
 * each extracted event lands in needs_review in the Event Radar queue.
 *
 * POST { text: string }
 *   → 200 TextImportResult
 *   → 400 missing/short text · 403 not admin · 500 unexpected
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_TEXT_CHARS = 40_000

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let body: { text?: unknown }
  try {
    body = (await request.json()) as { text?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const text =
    typeof body.text === 'string' ? body.text.slice(0, MAX_TEXT_CHARS).trim() : ''
  if (text.length < 10) {
    return NextResponse.json({ ok: false, error: 'text_required' }, { status: 400 })
  }

  const importedBy = await currentUserId()

  try {
    const result = await importFromText(text, importedBy)
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[api/admin/event-radar/import-text] failed:', err)
    return NextResponse.json({ ok: false, error: 'import_failed' }, { status: 500 })
  }
}
