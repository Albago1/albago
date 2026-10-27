import { NextResponse } from 'next/server'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import { decideSource, setSourceInterval } from '@/integrations/albago/runner'

/**
 * A decision on a known website (admin only).
 * POST { id, action: 'approve' | 'reject' | 'pause' | 'interval', hours?, reason? }.
 * Approved sites are re-read on a schedule without spending searches;
 * rejected ones are remembered and never proposed again.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIONS = ['approve', 'reject', 'pause', 'interval'] as const

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  let body: { id?: unknown; action?: unknown; hours?: unknown; reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }
  const id = typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null
  const action = ACTIONS.find((a) => a === body.action) ?? null
  if (!id || !action) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  try {
    if (action === 'interval') {
      const hours = typeof body.hours === 'number' ? body.hours : NaN
      await setSourceInterval(id, hours)
    } else {
      const reason = typeof body.reason === 'string' ? body.reason.slice(0, 300) : null
      await decideSource(id, action, await currentUserId(), reason)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed'
    return NextResponse.json({ ok: false, error: 'source_update_failed', message: message.slice(0, 200) }, { status: 500 })
  }
}
