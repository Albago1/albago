import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeCrawlSubmission } from './sanitizeSubmission'

/**
 * AlbaGo Crawl — queue SELECTED finds (per-item curation). Server-only: the DB
 * write. The untrusted-input coercion lives in the pure `sanitizeCrawlSubmission`
 * (tested separately); this module only inserts what survives it.
 */

export type QueueSelectedResult = {
  requested: number
  queued: number
  skipped: number
  items: Array<{ title: string; ok: boolean; error?: string }>
}

/**
 * Insert an admin-chosen set of previewed finds as `pending` submissions.
 * Each row is sanitized first; one bad row never blocks the rest. Uses the
 * service-role client (the crawler is a trusted server process with no auth
 * user) — the same path a live crawl insert takes.
 */
export async function queueSelectedSubmissions(
  rawList: unknown[],
  submittedBy: string | null,
): Promise<QueueSelectedResult> {
  const admin: SupabaseClient = createAdminClient()
  const items: QueueSelectedResult['items'] = []
  let queued = 0
  let skipped = 0

  for (const raw of rawList) {
    const clean = sanitizeCrawlSubmission(raw, submittedBy)
    if (!clean) {
      skipped++
      const title =
        (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).title === 'string'
          ? ((raw as Record<string, unknown>).title as string)
          : '') || 'Untitled'
      items.push({ title, ok: false, error: 'Missing a title or a valid date.' })
      continue
    }
    const { error } = await admin.from('event_submissions').insert(clean).select('id').single()
    if (error) {
      skipped++
      items.push({ title: clean.title, ok: false, error: error.message })
    } else {
      queued++
      items.push({ title: clean.title, ok: true })
    }
  }

  return { requested: rawList.length, queued, skipped, items }
}
