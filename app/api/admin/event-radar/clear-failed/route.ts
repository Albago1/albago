import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { clearFailedCandidates } from '@/lib/radar/service'

/**
 * Bulk-remove every unreadable (`failed`) candidate — the dead imports a
 * discovery run leaves behind. Admin session required.
 * POST → { ok, deleted }
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  const res = await clearFailedCandidates()
  return NextResponse.json(res, { status: res.ok ? 200 : 500 })
}
