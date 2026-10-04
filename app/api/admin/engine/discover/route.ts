import { NextResponse } from 'next/server'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import { runDiscovery } from '@/integrations/albago/runner'

/**
 * Manual AI discovery run (admin only).
 * POST { goal?: string } → runs that target, or the most overdue one when
 * omitted / "next". Same free-tier gate as the daily cron. Findings land in
 * the engine review queue; nothing is published until a human approves it.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

  let goalId: string | undefined
  try {
    const body = (await request.json()) as { goal?: unknown }
    if (typeof body.goal === 'string' && /^[a-z0-9_-]{2,60}$/.test(body.goal)) goalId = body.goal
  } catch {
    // no body = run the next due target
  }

  try {
    const outcome = await runDiscovery({ goalId, triggeredBy: await currentUserId() })
    if (!outcome.ran) return NextResponse.json({ ok: true, ran: false, reason: outcome.reason })
    const { report } = outcome
    return NextResponse.json({ ok: true, ran: true, goal: outcome.label, runId: report.runId, status: report.status, stats: report.stats, summary: report.summary, error: report.error })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'discovery_failed'
    console.error('[engine discover]', message)
    return NextResponse.json({ ok: false, error: 'discovery_failed', message: message.slice(0, 300) }, { status: 500 })
  }
}
