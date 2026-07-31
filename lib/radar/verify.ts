import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { readEventFromUrl } from '@/lib/ai/urlReader'
import { safeExternalUrl } from '@/lib/ticketDisplay'
import { decideVerify, type VerifyAction } from './verifyDecide'

/**
 * Verification loop ("check the catalog constantly"). Walks published, upcoming
 * events that carry an `official_source_url`, re-reads each source through the
 * same Lens pipeline, and keeps the listing honest — stamping `last_verified_at`
 * when an event is re-confirmed and flagging (never silently cancelling) when
 * something changed. See verifyDecide.ts for the safety rationale.
 *
 * Bounded per run (least-recently-verified first) so it sweeps the whole catalog
 * over many cheap runs instead of one giant one, and so a growing catalog never
 * blows the function budget.
 */

// Politeness between source re-reads — one page at a time.
const POLITE_DELAY_MS = 800

// How many events one run re-checks. The cron runs daily; least-recently-checked
// first means the whole catalog cycles through within days even as it grows.
const DEFAULT_LIMIT = 40

// Stop starting new re-reads at this wall-clock mark (function budget is larger).
const DEFAULT_DEADLINE_MS = 240_000

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function admin(): SupabaseClient {
  return createAdminClient()
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

type VerifiableEvent = {
  id: string
  slug: string | null
  title: string
  date: string
  listing_status: string | null
  official_source_url: string | null
  last_verified_at: string | null
}

export type VerifyItem = {
  eventId: string
  slug: string | null
  title: string
  action: VerifyAction
  observedDate?: string
  note: string
}

export type VerifyReport = {
  ranAt: string
  checked: number
  verified: number
  dateChanged: number
  flaggedChanged: number
  flaggedMissing: number
  unreadable: number
  /** Events needing a human look (changed / different event / gone dark). */
  flags: VerifyItem[]
  items: VerifyItem[]
}

/**
 * Pull the next batch of events due for verification: published, not already
 * ended, with a usable source URL, least-recently-verified first (NULLs — never
 * verified — come first).
 */
async function dueEvents(limit: number): Promise<VerifiableEvent[]> {
  const { data, error } = await admin()
    .from('events')
    .select('id, slug, title, date, listing_status, official_source_url, last_verified_at')
    .eq('status', 'published')
    .not('official_source_url', 'is', null)
    .gte('date', todayIso())
    .neq('listing_status', 'cancelled') // a cancelled listing is settled; don't churn it
    .order('last_verified_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) {
    console.error('[verify] dueEvents query failed:', error.code ?? '', error.message)
    return []
  }
  return (data as VerifiableEvent[] | null) ?? []
}

/** Apply a verdict's writes to one event. Best-effort — a write failure is logged
 *  and never aborts the sweep. */
async function applyVerdict(
  eventId: string,
  stampVerified: boolean,
  newListingStatus: 'updated' | null,
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (stampVerified) patch.last_verified_at = new Date().toISOString()
  if (newListingStatus) patch.listing_status = newListingStatus
  if (Object.keys(patch).length === 0) return
  const { error } = await admin().from('events').update(patch).eq('id', eventId)
  if (error) console.error('[verify] update failed for', eventId, error.message)
}

export async function verifyEvents(opts: {
  limit?: number
  deadlineMs?: number
}): Promise<VerifyReport> {
  const limit = opts.limit ?? DEFAULT_LIMIT
  const deadline = Date.now() + (opts.deadlineMs ?? DEFAULT_DEADLINE_MS)

  const report: VerifyReport = {
    ranAt: new Date().toISOString(),
    checked: 0,
    verified: 0,
    dateChanged: 0,
    flaggedChanged: 0,
    flaggedMissing: 0,
    unreadable: 0,
    flags: [],
    items: [],
  }

  const events = await dueEvents(limit)
  const today = todayIso()

  for (let i = 0; i < events.length; i++) {
    if (i > 0 && Date.now() > deadline) break
    const ev = events[i]

    // The URL is validated on the way in, but re-guard: never fetch a non-http(s)
    // or malformed source, and never fetch a private-range host (safeFetch inside
    // the reader also guards, this just skips obvious junk cheaply).
    const url = safeExternalUrl(ev.official_source_url)
    if (!url) {
      report.checked++
      const item: VerifyItem = {
        eventId: ev.id,
        slug: ev.slug,
        title: ev.title,
        action: 'unreadable',
        note: 'Stored source URL is not a valid public link.',
      }
      report.unreadable++
      report.items.push(item)
      report.flags.push(item)
      continue
    }

    let reading = null
    try {
      const read = await readEventFromUrl(url, today)
      reading = read?.reading ?? null
    } catch (err) {
      console.error('[verify] read failed for', ev.id, err instanceof Error ? err.message : err)
      reading = null
    }

    const verdict = decideVerify({ title: ev.title, date: ev.date }, reading)
    await applyVerdict(ev.id, verdict.stampVerified, verdict.newListingStatus)

    const item: VerifyItem = {
      eventId: ev.id,
      slug: ev.slug,
      title: ev.title,
      action: verdict.action,
      observedDate: verdict.observedDate,
      note: verdict.note,
    }
    report.items.push(item)
    report.checked++

    if (verdict.action === 'verified') report.verified++
    else if (verdict.action === 'date_changed') {
      report.dateChanged++
      report.flags.push(item)
    } else if (verdict.action === 'flag_changed') {
      report.flaggedChanged++
      report.flags.push(item)
    } else if (verdict.action === 'flag_missing') {
      report.flaggedMissing++
      report.flags.push(item)
    } else {
      report.unreadable++
    }

    if (i < events.length - 1) await wait(POLITE_DELAY_MS)
  }

  return report
}
