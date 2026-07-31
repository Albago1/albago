import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { runRegistryDiscovery } from '@/lib/radar/discovery'

/**
 * "Run all now" — the on-demand twin of the nightly discovery cron. Crawls every
 * ENABLED source in the registry and lands new finds in the Event Radar queue,
 * stamping each source's last-run yield. Admin session required. Nothing
 * publishes. Same engine, same result as the scheduled run.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  try {
    const report = await runRegistryDiscovery({ deadlineMs: 270_000 })
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[api/admin/sources/run] failed:', err)
    return NextResponse.json({ ok: false, error: 'run_failed' }, { status: 500 })
  }
}
