import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { runMonitoring } from '@/integrations/albago/runner'

/**
 * Event Engine monitoring lane: re-reads the websites an admin approved, 3×
 * a day (vercel.json — one daily entry per slot, so it works on the Hobby
 * plan). Spends no searches; an unchanged page costs nothing. Findings wait
 * in /admin/engine for review. Skips while another monitoring run is active
 * and when nothing is due, so missed or duplicate invocations are harmless.
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
    const outcome = await runMonitoring({ triggeredBy: null })
    if (!outcome.ran) {
      console.log(`[cron/engine-sources] skipped: ${outcome.reason}`)
      return NextResponse.json({ ok: true, ran: false, reason: outcome.reason })
    }
    const s = outcome.report.stats
    console.log(`[cron/engine-sources] ${outcome.report.status} · sites ${s.sources} · unchanged ${s.unchanged} · new ${s.new} · known ${s.known} · errors ${s.errors}`)
    return NextResponse.json({ ok: true, ran: true, status: outcome.report.status, stats: s })
  } catch (err) {
    console.error('[cron/engine-sources] failed:', err)
    return NextResponse.json({ ok: false, error: 'monitoring_failed' }, { status: 500 })
  }
}
