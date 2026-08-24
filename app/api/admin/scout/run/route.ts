import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { runScout } from '@/lib/scout/service'
import { clampDays } from '@/lib/scout/brief'

/**
 * "Search now" — the on-demand twin of the nightly Scout cron, so an admin never
 * has to wait until 03:00 to see whether the beat is producing anything.
 *
 * Same engine, same queue, same human approval. Optional body:
 *   {
 *     area?: string,      // "Tirana, Albania" | "Albania" | "Germany"
 *     scope?: 'local' | 'diaspora',
 *     days?: number
 *   }
 * With no area it runs this day's slice of the standing beat, exactly as the
 * cron would — so pressing the button is a true rehearsal of the nightly run.
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

  // `city` is accepted as an alias so an older client keeps working.
  const areaRaw =
    typeof body.area === 'string' ? body.area : typeof body.city === 'string' ? body.city : ''
  const area = areaRaw.trim()
  const scope = body.scope === 'diaspora' ? ('diaspora' as const) : ('local' as const)

  try {
    const report = await runScout({
      // A typed area runs just that one — the fastest way to test a beat.
      ...(area ? { areas: [area], scope } : {}),
      days: clampDays(body.days),
      deadlineMs: 240_000,
    })
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[admin/scout] failed:', err)
    return NextResponse.json({ ok: false, error: 'scout_failed' }, { status: 500 })
  }
}
