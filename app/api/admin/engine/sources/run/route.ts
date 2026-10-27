import { NextResponse } from 'next/server'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import { runMonitoring } from '@/integrations/albago/runner'

/**
 * Re-read the approved websites that are due, now (admin only). Same daily
 * page cap as the cron; no searches are spent. Findings wait in review.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  if (!(await isRequestAdmin())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  try {
    const outcome = await runMonitoring({ triggeredBy: await currentUserId() })
    if (!outcome.ran) return NextResponse.json({ ok: true, ran: false, reason: outcome.reason })
    return NextResponse.json({ ok: true, ran: true, status: outcome.report.status, stats: outcome.report.stats })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'monitoring_failed'
    console.error('[engine sources run]', message)
    return NextResponse.json({ ok: false, error: 'monitoring_failed', message: message.slice(0, 300) }, { status: 500 })
  }
}
