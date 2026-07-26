import { isPublicHttpUrl } from '@/lib/ssrfGuard'

/**
 * Event Radar (RADAR-1) URL hygiene. Pure — no network, safe in tests.
 *
 * The normalized form is the dedup key for event_import_candidates: two pastes
 * of the "same" page (with different tracking params, casing, or a trailing
 * slash) must collapse to one candidate so an admin can't import a source
 * twice (spec §4.9, §12). Structural SSRF validation is delegated to the shared
 * isPublicHttpUrl guard, so a private/loopback/non-http URL normalizes to null.
 */

// Query params that identify a campaign/click, never the content. Dropped so
// the same page shared from different places dedups to one candidate.
const TRACKING_PREFIXES = ['utm_', 'mc_']
const TRACKING_KEYS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'gclsrc',
  'igshid',
  'mkt_tok',
  'ref',
  'ref_src',
  'ref_url',
  'source',
  'spm',
  '_ga',
])

function isTrackingParam(key: string): boolean {
  const k = key.toLowerCase()
  if (TRACKING_KEYS.has(k)) return true
  return TRACKING_PREFIXES.some((p) => k.startsWith(p))
}

/**
 * Validate + canonicalize a pasted URL into its dedup key, or null when it is
 * not a fetchable public http(s) URL. Lowercases the host, drops the fragment
 * and tracking params, sorts the surviving params, and trims a trailing slash.
 */
export function normalizeImportUrl(raw: string): string | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null

  const safe = isPublicHttpUrl(trimmed)
  if (!safe) return null

  const url = new URL(safe.toString())
  url.hostname = url.hostname.toLowerCase()
  url.hash = ''

  // Trim a trailing slash on the PATH ("…/event/" ⇒ "…/event") so the two forms
  // share a key even when a query follows. Never touch a root "/".
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  const kept: [string, string][] = []
  for (const [key, value] of url.searchParams.entries()) {
    if (!isTrackingParam(key)) kept.push([key, value])
  }
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  url.search = ''
  for (const [key, value] of kept) url.searchParams.append(key, value)

  return url.toString()
}

/** Human-facing source label: the registrable host without a leading www. */
export function sourceNameFromUrl(raw: string): string | null {
  const safe = isPublicHttpUrl(raw.trim())
  if (!safe) return null
  return safe.hostname.toLowerCase().replace(/^www\./, '')
}
