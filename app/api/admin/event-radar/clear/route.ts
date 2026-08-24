import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { clearCandidates, type ClearScope } from '@/lib/radar/service'

/**
 * Bulk-clear the Event Radar queue.
 *
 * POST { scope: 'failed' | 'decided' | 'all' } → { ok, deleted }
 *
 * 'all' is a genuine reset: it also removes the rejected candidates that
 * currently stop the agent re-queueing things you already turned down, so the
 * next run may legitimately find them again. That is the point of a reset — the
 * UI says so before it asks for confirmation.
 *
 * Never touches event_submissions or events: an approved candidate's submission
 * survives, only the import trail goes.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SCOPES: ClearScope[] = ['failed', 'decided', 'all']

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let scope: ClearScope = 'failed'
  try {
    const body = await request.json()
    const raw = (body as { scope?: unknown } | null)?.scope
    // Default to the narrowest scope rather than the widest: a malformed body
    // must never be interpreted as "delete everything".
    if (typeof raw === 'string' && SCOPES.includes(raw as ClearScope)) {
      scope = raw as ClearScope
    }
  } catch {
    /* no body → 'failed' */
  }

  const res = await clearCandidates(scope)
  return NextResponse.json({ ...res, scope }, { status: res.ok ? 200 : 500 })
}
