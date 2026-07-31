import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { runDiscovery } from '@/lib/radar/discovery'

/**
 * Discovery Agent (admin trigger): expand ONE source page into every event it
 * links to and import each as a reviewable candidate. Same engine the nightly
 * cron uses — this is the human-in-the-loop entry point. Admin session required.
 * Nothing is published; each find lands in needs_review in the Event Radar queue.
 *
 * POST { sourceUrl: string }
 *   → 200 DiscoveryReport
 *   → 400 missing url · 403 not admin · 500 unexpected
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_URL_LEN = 2048

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let body: { sourceUrl?: unknown }
  try {
    body = (await request.json()) as { sourceUrl?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const sourceUrl =
    typeof body.sourceUrl === 'string' ? body.sourceUrl.trim().slice(0, MAX_URL_LEN) : ''
  if (!sourceUrl) {
    return NextResponse.json({ ok: false, error: 'url_required' }, { status: 400 })
  }

  try {
    // Leave headroom under maxDuration for the response to serialize.
    const report = await runDiscovery({ sourceUrls: [sourceUrl], deadlineMs: 50_000 })
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[api/admin/event-radar/discover] failed:', err)
    return NextResponse.json({ ok: false, error: 'discovery_failed' }, { status: 500 })
  }
}
