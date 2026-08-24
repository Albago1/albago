import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { runScout } from '@/lib/scout/service'

/**
 * Nightly Scout cron (Phase 39). Searches the web for upcoming events in the
 * configured cities and files each find as a reviewable draft in the Event Radar
 * queue. Nothing is published — a human approves every event.
 *
 * Complements /api/cron/discover: that one re-crawls known sites, this one goes
 * looking for events on sites nobody has registered yet. Same queue, same
 * verification, same approval.
 *
 * Auth: Vercel Cron's `Authorization: Bearer <CRON_SECRET>` (see lib/cron/auth).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  try {
    // Headroom under maxDuration for the response and any in-flight brief.
    const report = await runScout({ deadlineMs: 240_000 })
    console.log(
      `[cron/scout] briefs ${report.briefsProcessed}/${report.briefsRequested} · found ${report.found} · imported ${report.imported} · dup ${report.duplicate} · notEvent ${report.notEvent} · invalid ${report.invalid} · err ${report.errors}`,
    )
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[cron/scout] failed:', err)
    return NextResponse.json({ ok: false, error: 'scout_failed' }, { status: 500 })
  }
}
