import { NextResponse } from 'next/server'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import { albagoEngine } from '@/integrations/albago/wiring'
import { BLOCKED_HOSTS, tiranaNext14Days } from '@/integrations/albago/goals'

/**
 * Manual AI discovery run (admin only) — no schedule yet, by design.
 * Runs AlbaGo's "Tirana, next 14 days" goal with a budget that fits one
 * serverless invocation. Findings land in the engine review queue; nothing
 * is published until a human approves it.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  if (!(await isRequestAdmin())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

  const goal = tiranaNext14Days()
  // Stay inside the 300 s function limit even with free-tier pacing.
  goal.budget = { ...goal.budget, max_searches: 8, max_fetches: 16, max_minutes: 4 }

  try {
    const report = await albagoEngine().discover(goal, { triggeredBy: await currentUserId(), blockedHosts: BLOCKED_HOSTS })
    return NextResponse.json({ ok: true, runId: report.runId, status: report.status, stats: report.stats, summary: report.summary, error: report.error })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'discovery_failed'
    console.error('[engine discover]', message)
    return NextResponse.json({ ok: false, error: 'discovery_failed', message: message.slice(0, 300) }, { status: 500 })
  }
}
