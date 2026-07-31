import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { verifyEvents } from '@/lib/radar/verify'

/**
 * Daily verification cron. Re-reads the source of published, upcoming events that
 * carry an official_source_url, stamps last_verified_at on the ones still live,
 * and flags (never auto-cancels) anything that changed. Least-recently-verified
 * first, bounded per run, so the whole catalog cycles through over several days.
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
    const report = await verifyEvents({ deadlineMs: 270_000 })
    console.log(
      `[cron/verify] checked ${report.checked} · verified ${report.verified} · dateChanged ${report.dateChanged} · flaggedChanged ${report.flaggedChanged} · flaggedMissing ${report.flaggedMissing} · unreadable ${report.unreadable}`,
    )
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[cron/verify] failed:', err)
    return NextResponse.json({ ok: false, error: 'verify_failed' }, { status: 500 })
  }
}
