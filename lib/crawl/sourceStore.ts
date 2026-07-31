import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeImportUrl, sourceNameFromUrl } from '@/lib/radar/normalizeUrl'

/**
 * Discovery Agent — the source registry store (Stage 3). The persistent list of
 * pages the nightly cron checks, managed from /admin/sources. Server-only
 * (service-role client), reached only behind the admin guard. Every read/write
 * fails SOFT (returns a sensible empty/false) so a missing table or a transient
 * DB error can never crash the cron or the admin page — the panel just shows an
 * empty list until the migration (docs/seeds/crawl-sources.sql) is applied.
 */

const TABLE = 'crawl_sources'

export type CrawlSourceRow = {
  id: string
  url: string
  normalized_url: string
  label: string | null
  kind: string | null
  enabled: boolean
  last_run_at: string | null
  last_found_count: number | null
  last_status: 'ok' | 'error' | 'empty' | null
  created_at: string
  updated_at: string
}

function admin(): SupabaseClient {
  return createAdminClient()
}

/** All sources, newest first, for the admin panel. */
export async function listSources(): Promise<CrawlSourceRow[]> {
  try {
    const { data, error } = await admin()
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[sourceStore] list failed:', error.code ?? '', error.message)
      return []
    }
    return (data as CrawlSourceRow[] | null) ?? []
  } catch (err) {
    console.error('[sourceStore] list threw:', err)
    return []
  }
}

/** The normalized URLs the nightly cron should crawl (enabled only). */
export async function listEnabledSourceUrls(): Promise<string[]> {
  try {
    const { data, error } = await admin()
      .from(TABLE)
      .select('normalized_url')
      .eq('enabled', true)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[sourceStore] enabled list failed:', error.code ?? '', error.message)
      return []
    }
    return ((data as { normalized_url: string }[] | null) ?? []).map((r) => r.normalized_url)
  } catch {
    return []
  }
}

export type AddSourcesResult = {
  added: number
  duplicates: number
  invalid: string[]
}

/**
 * Bulk-add pasted/uploaded URLs. Each line is normalized (tracking params
 * stripped, host lowercased, private/non-http rejected → invalid). Duplicates
 * — within the input and against existing rows — are collapsed on the unique
 * normalized_url so re-adding a list is safe and idempotent.
 */
export async function addSources(
  rawUrls: string[],
  createdBy: string | null,
): Promise<AddSourcesResult> {
  const invalid: string[] = []
  // Normalize + dedupe the input, remembering one original form per key.
  const byKey = new Map<string, string>()
  for (const raw of rawUrls) {
    const line = (raw ?? '').trim()
    if (!line) continue
    const normalized = normalizeImportUrl(line)
    if (!normalized) {
      invalid.push(line)
      continue
    }
    if (!byKey.has(normalized)) byKey.set(normalized, normalized)
  }
  if (byKey.size === 0) return { added: 0, duplicates: 0, invalid }

  const keys = [...byKey.keys()]
  const db = admin()

  // Which are already stored? (so we can report added vs. duplicates honestly)
  const { data: existingRows } = await db
    .from(TABLE)
    .select('normalized_url')
    .in('normalized_url', keys)
  const existing = new Set(
    ((existingRows as { normalized_url: string }[] | null) ?? []).map((r) => r.normalized_url),
  )

  const toInsert = keys
    .filter((k) => !existing.has(k))
    .map((k) => ({
      url: k,
      normalized_url: k,
      label: sourceNameFromUrl(k),
      enabled: true,
      created_by: createdBy,
    }))

  if (toInsert.length === 0) {
    return { added: 0, duplicates: keys.length, invalid }
  }

  // ignoreDuplicates guards the race where two admins add the same source at once.
  const { data, error } = await db
    .from(TABLE)
    .upsert(toInsert, { onConflict: 'normalized_url', ignoreDuplicates: true })
    .select('id')
  if (error) {
    console.error('[sourceStore] bulk insert failed:', error.code ?? '', error.message)
    return { added: 0, duplicates: keys.length - toInsert.length, invalid }
  }
  const added = (data as { id: string }[] | null)?.length ?? toInsert.length
  return { added, duplicates: keys.length - added, invalid }
}

export async function setSourceEnabled(id: string, enabled: boolean): Promise<boolean> {
  const { error } = await admin()
    .from(TABLE)
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error('[sourceStore] toggle failed:', error.message)
  return !error
}

export async function deleteSource(id: string): Promise<boolean> {
  const { error } = await admin().from(TABLE).delete().eq('id', id)
  if (error) console.error('[sourceStore] delete failed:', error.message)
  return !error
}

/** Stamp a source's last-run telemetry after a discovery pass. Best-effort. */
export async function recordRun(
  normalizedUrl: string,
  foundCount: number,
  status: 'ok' | 'error' | 'empty',
): Promise<void> {
  const { error } = await admin()
    .from(TABLE)
    .update({
      last_run_at: new Date().toISOString(),
      last_found_count: foundCount,
      last_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('normalized_url', normalizedUrl)
  if (error) console.error('[sourceStore] recordRun failed:', error.message)
}
