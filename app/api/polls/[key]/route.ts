import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPollClosed, pollByKey, type Poll } from '@/lib/polls'

/**
 * Fan poll votes.
 *   GET   → { ok, totals: { [choice]: votes }, total, closed }
 *   POST  { session_id, choice } → the same, after saving the vote
 *
 * Anonymous: the browser's random session id is the voter (one vote per
 * session per poll; voting again changes it). No IP or user id is stored —
 * the IP is only used, in memory, to rate-limit. `poll_votes` has no RLS
 * policies, so this route (service role) is the only way in or out.
 */

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// -- In-memory rate limit (per instance, same trade-off as /api/track) -------
const RATE_WINDOW_MS = 60_000
const RATE_MAX_PER_WINDOW = 20
const RATE_MAP_MAX = 5000
const rateMap = new Map<string, { windowStart: number; count: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    if (rateMap.size >= RATE_MAP_MAX) {
      const oldestKey = rateMap.keys().next().value
      if (oldestKey) rateMap.delete(oldestKey)
    }
    rateMap.set(ip, { windowStart: now, count: 1 })
    return false
  }
  entry.count += 1
  return entry.count > RATE_MAX_PER_WINDOW
}

async function totalsOf(poll: Poll) {
  const supabase = createAdminClient()
  // No generated DB types on the admin client; the args resolve to `undefined` without this cast.
  const { data, error } = await supabase.rpc('poll_totals', { p_poll: poll.key } as never)
  if (error) return null
  const totals: Record<string, number> = Object.fromEntries(poll.options.map((o) => [o.key, 0]))
  for (const row of (data ?? []) as Array<{ choice: string; votes: number }>) {
    if (row.choice in totals) totals[row.choice] = Number(row.votes)
  }
  return { totals, total: Object.values(totals).reduce((a, b) => a + b, 0) }
}

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const poll = pollByKey((await params).key)
  if (!poll) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const result = await totalsOf(poll)
  if (!result) return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 })
  return NextResponse.json(
    { ok: true, ...result, closed: isPollClosed(poll) },
    { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } },
  )
}

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const poll = pollByKey((await params).key)
  if (!poll) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  if (isPollClosed(poll)) return NextResponse.json({ ok: false, error: 'closed' }, { status: 409 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  let body: { session_id?: unknown; choice?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const sessionId = typeof body.session_id === 'string' && UUID_RE.test(body.session_id) ? body.session_id : null
  const choice = typeof body.choice === 'string' && poll.options.some((o) => o.key === body.choice) ? body.choice : null
  if (!sessionId || !choice) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })

  const supabase = createAdminClient()
  // The shared admin client carries no generated DB types; the row resolves to `never` without this cast.
  const { error } = await supabase
    .from('poll_votes')
    .upsert({ poll: poll.key, session_id: sessionId, choice, updated_at: new Date().toISOString() } as never, {
      onConflict: 'poll,session_id',
    })
  if (error) {
    console.error('poll vote failed:', error.message)
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 })
  }
  const result = await totalsOf(poll)
  return NextResponse.json({ ok: true, ...(result ?? { totals: null, total: null }), closed: false })
}
