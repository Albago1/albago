import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { testSource } from '@/integrations/albago/runner'

/**
 * Read a registered website now and show what the engine would take from it
 * (admin only). POST { id }. Nothing is saved; robots.txt is respected. At
 * most two free AI calls, none for pages with structured event data.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  let id: string | null = null
  try {
    const body = (await request.json()) as { id?: unknown }
    id = typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null
  } catch {
    // handled below
  }
  if (!id) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, preview: await testSource(id) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'test_failed'
    console.error('[engine sources test]', message)
    return NextResponse.json({ ok: false, error: 'test_failed', message: message.slice(0, 300) }, { status: 500 })
  }
}
