import { NextResponse } from 'next/server'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import { decideArtist } from '@/integrations/albago/runner'

/**
 * Confirm or reject an artist the engine learned (admin only).
 * POST { id, decision: 'confirm' | 'reject' }. Confirmed artists join the
 * artist watch and count as Albanian performers anywhere in the world;
 * rejected ones are remembered and never proposed again.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  let body: { id?: unknown; decision?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }
  const id = typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null
  const decision = body.decision === 'confirm' || body.decision === 'reject' ? body.decision : null
  if (!id || !decision) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  try {
    await decideArtist(id, decision, await currentUserId())
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed'
    return NextResponse.json({ ok: false, error: 'decide_failed', message: message.slice(0, 200) }, { status: 500 })
  }
}
