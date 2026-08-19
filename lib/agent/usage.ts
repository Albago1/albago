import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

/** Same shim lib/radar/service.ts uses: the shared admin client carries no
 *  generated table types, so an untyped handle is what makes a plain insert
 *  type-check instead of collapsing to `never`. */
function admin(): SupabaseClient {
  return createAdminClient()
}

/**
 * The AI meter.
 *
 * Nothing in this codebase has ever recorded a token (audit §21). A one-shot
 * scan you can reason about; a conversation you cannot — one event might be a
 * dozen model calls, and a confused loop is more. So the agent records every
 * turn.
 *
 * Two rules, both about not making things worse:
 *  - Service role, never the browser. A client that could write its own usage
 *    rows could also decline to.
 *  - Never throws, never blocks. A failed metering write must not cost the
 *    admin the reply they were waiting for; it warns and moves on.
 */

export type UsageRecord = {
  surface: string
  userId: string | null
  model: string | null
  inputTokens: number
  outputTokens: number
  totalTokens: number
  tools: string[]
}

export async function recordUsage(record: UsageRecord): Promise<void> {
  try {
    const { error } = await admin()
      .from('ai_usage')
      .insert({
        surface: record.surface,
        user_id: record.userId,
        model: record.model,
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        total_tokens: record.totalTokens,
        tools: record.tools,
      })
    if (error) {
      // Unapplied migration presents exactly here. Warn loudly enough to find
      // in logs, quietly enough that the feature still works without it.
      console.warn('[ai_usage] not recorded:', error.message)
    }
  } catch (err) {
    console.warn('[ai_usage] not recorded:', err)
  }
}

/** Tokens spent on one surface over the last N days. Returns null when the
 *  ledger is unavailable (migration not applied), so callers can stay silent
 *  rather than render a confident zero. */
export async function recentTokenTotal(
  surface: string,
  days = 30,
): Promise<number | null> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await admin()
      .from('ai_usage')
      .select('total_tokens')
      .eq('surface', surface)
      .gte('created_at', since)
    if (error || !data) return null
    return (data as { total_tokens: number }[]).reduce((sum, r) => sum + (r.total_tokens ?? 0), 0)
  } catch {
    return null
  }
}
