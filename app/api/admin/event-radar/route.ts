import { NextResponse } from 'next/server'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import { importFromUrl } from '@/lib/radar/service'

/**
 * Event Radar (RADAR-1): import ONE public event URL into a reviewable
 * candidate. Admin session required. The heavy work (SSRF-guarded fetch + AI
 * extraction + resolution) runs here, so it takes the same generous budget as
 * the crawler. Nothing is ever published — a candidate lands in needs_review.
 *
 * POST { url: string }
 *   → 200 { ok, candidateId, status, duplicate }
 *   → 400 invalid url · 401 not admin · 500 db error
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_URL_LEN = 2048

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let body: { url?: unknown }
  try {
    body = (await request.json()) as { url?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const url = typeof body.url === 'string' ? body.url.trim().slice(0, MAX_URL_LEN) : ''
  if (!url) {
    return NextResponse.json({ ok: false, error: 'url_required' }, { status: 400 })
  }

  const importedBy = await currentUserId()

  try {
    const result = await importFromUrl(url, importedBy)
    if (!result.ok) {
      const status = result.code === 'invalid_url' ? 400 : 500
      return NextResponse.json({ ok: false, error: result.code, message: result.message }, { status })
    }
    return NextResponse.json({
      ok: true,
      candidateId: result.candidate.id,
      status: result.candidate.status,
      duplicate: result.duplicate,
    })
  } catch (err) {
    console.error('[api/admin/event-radar] import failed:', err)
    return NextResponse.json({ ok: false, error: 'import_failed' }, { status: 500 })
  }
}
