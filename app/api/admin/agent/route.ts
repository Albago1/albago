import { NextResponse } from 'next/server'
import type { ModelMessage } from 'ai'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { runAgentTurn } from '@/lib/agent/run'
import type { EventDraft } from '@/types/eventDraftBase'

/**
 * Phase 37 — the event ingestion agent, one turn per request.
 *
 * POST { messages, draft? } → { ok, text, draft, toolsCalled, usage }
 *
 * Admin-gated like every other /api/admin route: the /admin pages guard
 * themselves, but a route handler is its own entry point and re-checks.
 * The agent can only ever return a draft — it holds no write path to `events`,
 * so the worst a bad turn can do is fill a form badly.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Guards against a runaway client: the whole conversation is re-sent each
 *  turn, so it needs a ceiling in both directions. */
const MAX_MESSAGES = 40
const MAX_CHARS_PER_MESSAGE = 20000

type Body = {
  messages?: unknown
  draft?: unknown
}

function coerceMessages(raw: unknown): ModelMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const messages: ModelMessage[] = []
  for (const item of raw.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== 'object') return null
    const { role, content } = item as { role?: unknown; content?: unknown }
    if (role !== 'user' && role !== 'assistant') return null
    if (typeof content !== 'string') return null
    messages.push({ role, content: content.slice(0, MAX_CHARS_PER_MESSAGE) })
  }
  return messages.length > 0 ? messages : null
}

export async function POST(request: Request) {
  if (!(await isRequestAdmin())) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 })
  }

  const messages = coerceMessages(body.messages)
  if (!messages) {
    return NextResponse.json({ ok: false, error: 'messages_required' }, { status: 400 })
  }

  // The draft is merged onto defaults inside runAgentTurn, so an unknown or
  // malformed key is dropped rather than trusted.
  const draft =
    body.draft && typeof body.draft === 'object'
      ? (body.draft as Partial<EventDraft> as EventDraft)
      : null

  try {
    const result = await runAgentTurn({ messages, draft })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[api/admin/agent] turn failed:', err)
    return NextResponse.json({ ok: false, error: 'agent_failed' }, { status: 500 })
  }
}
