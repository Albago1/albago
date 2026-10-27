import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { testSource } from '@/integrations/albago/runner'

/**
 * Read a website now and show what the engine would take from it (admin only).
 * POST { url }. Nothing is saved; robots.txt is respected. At most two free AI
 * calls, none for pages with structured event data.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  let url: string | null = null
  try {
    const body = (await request.json()) as { url?: unknown }
    url = typeof body.url === 'string' && /^https?:\/\//i.test(body.url) ? body.url.slice(0, 2000) : null
  } catch {
    // handled below
  }
  if (!url) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, preview: await testSource(url) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'test_failed'
    console.error('[engine sources test]', message)
    return NextResponse.json({ ok: false, error: 'test_failed', message: message.slice(0, 300) }, { status: 500 })
  }
}
