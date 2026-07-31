import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { runRegistryDiscovery } from '@/lib/radar/discovery'

/**
 * Nightly discovery cron. Runs the enabled source registry (runDiscovery with no
 * explicit URLs) and lands new finds in the Event Radar review queue. Nothing is
 * published — a human still approves each candidate. A no-op until sources are
 * enabled in the registry, so it's safe to schedule immediately.
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
    // Leave headroom under maxDuration for the response + any in-flight source.
    const report = await runRegistryDiscovery({ deadlineMs: 270_000 })
    console.log(
      `[cron/discover] sources ${report.sourcesProcessed}/${report.sourcesRequested} · found ${report.eventUrlsFound} · imported ${report.imported} · dup ${report.skippedDuplicate} · notEvent ${report.notEvent} · unreadable ${report.unreadable} · err ${report.errors}`,
    )
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[cron/discover] failed:', err)
    return NextResponse.json({ ok: false, error: 'discover_failed' }, { status: 500 })
  }
}
