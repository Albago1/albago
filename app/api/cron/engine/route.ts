import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { runDiscovery } from '@/integrations/albago/runner'

/**
 * Event Engine rotation. Scheduled several times a day (vercel.json — one
 * daily entry per slot, so it works on the Hobby plan). Each call researches
 * the most overdue target (a city or a batch of Albanian artists) inside the
 * free-tier caps; findings wait in /admin/engine for review. Missed or
 * duplicate invocations are harmless: the runner skips while a run is active
 * and only picks targets that are due.
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
    const outcome = await runDiscovery({ triggeredBy: null })
    if (!outcome.ran) {
      console.log(`[cron/engine] skipped: ${outcome.reason}`)
      return NextResponse.json({ ok: true, ran: false, reason: outcome.reason })
    }
    const s = outcome.report.stats
    console.log(`[cron/engine] ${outcome.goalId} · ${outcome.report.status} · searches ${s.searches} · read ${s.pages_read} · new ${s.new} · merged ${s.attached} · artists learned ${s.entities_proposed}`)
    return NextResponse.json({ ok: true, ran: true, goal: outcome.goalId, status: outcome.report.status, stats: s })
  } catch (err) {
    console.error('[cron/engine] failed:', err)
    return NextResponse.json({ ok: false, error: 'engine_run_failed' }, { status: 500 })
  }
}
