import { NextResponse } from 'next/server'
import type { ModelMessage } from 'ai'
import { isRequestAdmin, currentUserId } from '@/lib/admin/apiAuth'
import { runAgentTurn } from '@/lib/agent/run'
import { recordUsage } from '@/lib/agent/usage'
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
  attachments?: unknown
}

/** Attachments must be public URLs in OUR storage. The agent fetches them
 *  server-side, so accepting an arbitrary URL here would hand the caller an
 *  SSRF primitive; the origin check plus the per-turn allow-list in
 *  `read_image` means it can only ever fetch what we just uploaded. */
const MAX_ATTACHMENTS = 8

function coerceAttachments(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return []
  const prefix = `${base.replace(/\/$/, '')}/storage/v1/object/public/`
  return raw
    .filter((u): u is string => typeof u === 'string' && u.startsWith(prefix))
    .slice(0, MAX_ATTACHMENTS)
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
    const result = await runAgentTurn({
      messages,
      draft,
      attachments: coerceAttachments(body.attachments),
    })

    // Meter after the work, never in front of it: a failed metering write must
    // not cost the admin their reply. recordUsage swallows its own errors.
    void recordUsage({
      surface: 'compose',
      userId: await currentUserId(),
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
      tools: result.toolsCalled,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[api/admin/agent] turn failed:', err)
    // Distinguish the one failure the admin can actually act on — waiting —
    // from the ones they can't. Provider errors surface as 429s or quota text.
    const message = err instanceof Error ? err.message : ''
    const rateLimited = /rate.?limit|quota|429|resource.?exhausted/i.test(message)
    return NextResponse.json(
      { ok: false, error: rateLimited ? 'rate_limited' : 'agent_failed' },
      { status: rateLimited ? 429 : 500 },
    )
  }
}
