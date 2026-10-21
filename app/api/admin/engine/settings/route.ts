import { NextResponse } from 'next/server'
import { ExpirySettingsV1 } from '@/engine/server'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import { saveExpiry } from '@/integrations/albago/runner'

/**
 * Event Engine settings (admin only).
 * POST { expiry: { enabled, grace_days } } → saves and applies the clean-up
 * right away; returns how many ended suggestions were removed.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  let body: { expiry?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }
  const parsed = ExpirySettingsV1.safeParse(body.expiry)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'bad_settings' }, { status: 400 })
  try {
    const result = await saveExpiry(parsed.data, await currentUserId())
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'save_failed'
    console.error('[engine settings]', message)
    return NextResponse.json({ ok: false, error: 'save_failed', message: message.slice(0, 200) }, { status: 500 })
  }
}
