import { generateText, stepCountIs, type ModelMessage } from 'ai'
import { textModel } from '@/lib/ai/textModel'
import { defaultEventDraft, type EventDraft } from '@/types/eventDraftBase'
import { createAgentTools, type AgentContext } from './tools'
import { buildSystemPrompt } from './systemPrompt'

/**
 * One turn of the ingestion agent.
 *
 * Stateless by design: the draft arrives with the request and leaves with the
 * response. Vercel functions share no memory between invocations, so a
 * server-side session map would work locally and silently lose drafts in
 * production — the client owns the draft between turns.
 *
 * Stage A runs non-streaming so the tool loop can be asserted in a script.
 * Stage B swaps `generateText` for `streamText` over the same tools; nothing
 * else about this file changes.
 */

/** Tool calls per turn. Enough for read → resolve → summarize plus a retry;
 *  low enough that a confused model can't spend the budget in a loop. */
const MAX_STEPS = 8

export type AgentTurnInput = {
  messages: ModelMessage[]
  draft?: EventDraft | null
  todayIso?: string
  /** Image URLs the admin attached, already in our own storage. They become
   *  the event's gallery (first = cover) AND the only images read_image may
   *  fetch. Accumulated across the conversation by the client. */
  attachments?: string[]
}

export type AgentTurnResult = {
  /** The assistant's reply text. */
  text: string
  /** The draft after this turn — the client must send it back next turn. */
  draft: EventDraft
  /** Tool names called, in order. Surfaced for the UI's "what it did" line. */
  toolsCalled: string[]
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
  /** Recorded in the usage ledger — the model alias is a rolling pointer, so
   *  a cost review months later needs to know which one actually ran. */
  model: string
}

function todayInTirane(): string {
  // The catalogue is Albania-first; "today" for a past-date check should be
  // Albanian today, not the server's UTC midnight.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Tirane' })
}

export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const attachments = input.attachments ?? []
  const ctx: AgentContext = {
    draft: { ...defaultEventDraft, ...(input.draft ?? {}) },
    todayIso: input.todayIso ?? todayInTirane(),
    lastResolution: null,
    called: [],
    attachments,
  }

  // Attachments ARE the event's images: the wizard treats gallery_urls[0] as
  // the cover, and submitAdminEvent publishes it as banner_url. Set here
  // rather than in a tool so the pictures survive even if the model never
  // bothers to read them.
  if (attachments.length > 0) {
    const existing = new Set(ctx.draft.gallery_urls)
    ctx.draft.gallery_urls = [
      ...ctx.draft.gallery_urls,
      ...attachments.filter((url) => !existing.has(url)),
    ]
  }

  const model = textModel()
  const result = await generateText({
    model,
    system: buildSystemPrompt(ctx.todayIso, attachments),
    messages: input.messages,
    tools: createAgentTools(ctx),
    stopWhen: stepCountIs(MAX_STEPS),
  })

  return {
    text: result.text,
    draft: ctx.draft,
    toolsCalled: ctx.called,
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      totalTokens: result.usage.totalTokens ?? 0,
    },
    model: model.modelId,
  }
}
