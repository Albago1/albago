import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { runScout } from '@/lib/scout/service'
import { clampDays } from '@/lib/scout/brief'

/**
 * "Search now" — the on-demand twin of the nightly Scout cron, so an admin never
 * has to wait until 03:00 to see whether the beat is producing anything.
 *
 * Same engine, same queue, same human approval. Optional body:
 *   { city?: string, country?: string, days?: number }
 * With no body it runs the configured city list.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    const parsed = await request.json()
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>
    }
  } catch {
    // No body is the normal case for "run the configured beat".
  }

  const city = typeof body.city === 'string' ? body.city.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : ''

  try {
    const report = await runScout({
      // A single typed city runs just that one — the fastest way to test a beat.
      ...(city ? { cities: [{ city, country: country || 'Albania' }] } : {}),
      days: clampDays(body.days),
      deadlineMs: 240_000,
    })
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[admin/scout] failed:', err)
    return NextResponse.json({ ok: false, error: 'scout_failed' }, { status: 500 })
  }
}
