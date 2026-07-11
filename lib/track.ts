// First-party interaction tracking. Fire-and-forget, PII-free, never throws.
//
// - session_id: random UUID persisted in localStorage. Anonymous; lets SQL
//   count unique + returning sessions. No cookies, no IP, no fingerprinting.
// - UTM/referrer: captured once per tab from the landing URL, attached to
//   every interaction in that tab (sessionStorage).
// - *_view types are deduped per tab so re-renders and back-navigation don't
//   inflate counts.

export type TrackType =
  | 'event_view'
  | 'protest_view'
  | 'place_view'
  | 'placard_view'
  | 'placard_download'
  | 'share_click'
  | 'city_search'
  | 'search_query'
  | 'submit_started'
  | 'submit_completed'
  | 'calendar_add'
  | 'subscribe'
  | 'outbound_click'
  | 'lens_scan'
  | 'lens_apply'

export type TrackOptions = {
  entityType?: 'event' | 'place' | 'placard' | 'submission'
  entityId?: string | null
  city?: string | null
  country?: string | null
  platform?: string | null
  source?: string | null
  meta?: Record<string, unknown>
}

const SESSION_KEY = 'albago_sid'
const ATTRIBUTION_KEY = 'albago_attribution'
const SEEN_PREFIX = 'albago_seen:'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function randomUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
  } catch {
    // fall through
  }
  // Fallback for very old browsers — good enough for an anonymous counter.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getSessionId(): string | null {
  try {
    let sid = window.localStorage.getItem(SESSION_KEY)
    if (!sid || !UUID_RE.test(sid)) {
      sid = randomUuid()
      window.localStorage.setItem(SESSION_KEY, sid)
    }
    return sid
  } catch {
    return null
  }
}

type Attribution = {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
}

function getAttribution(): Attribution {
  const empty: Attribution = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    referrer: null,
  }
  try {
    const cached = window.sessionStorage.getItem(ATTRIBUTION_KEY)
    if (cached) return JSON.parse(cached) as Attribution
    const params = new URLSearchParams(window.location.search)
    const ref = document.referrer || null
    const attribution: Attribution = {
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      // Ignore self-referrals so internal navigation doesn't look like a source.
      referrer: ref && !ref.includes(window.location.host) ? ref.slice(0, 300) : null,
    }
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
    return attribution
  } catch {
    return empty
  }
}

/** True the first time this tab sees this key, false afterwards. */
function firstThisTab(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key)) return false
    window.sessionStorage.setItem(key, '1')
    return true
  } catch {
    return true
  }
}

export function trackInteraction(type: TrackType, opts: TrackOptions = {}): void {
  try {
    if (typeof window === 'undefined') return

    // Views are deduped per tab, per entity (or per path for page-level views).
    if (type.endsWith('_view')) {
      const seenKey = `${SEEN_PREFIX}${type}:${opts.entityId ?? window.location.pathname}`
      if (!firstThisTab(seenKey)) return
    }

    const sessionId = getSessionId()
    if (!sessionId) return

    const attribution = getAttribution()
    const body = JSON.stringify({
      type,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId && UUID_RE.test(opts.entityId) ? opts.entityId : null,
      city: opts.city ?? null,
      country: opts.country ?? null,
      platform: opts.platform ?? null,
      source: opts.source ?? null,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      path: window.location.pathname.slice(0, 300),
      referrer: attribution.referrer,
      session_id: sessionId,
      metadata: opts.meta ?? {},
    })

    // keepalive lets the request survive navigation (e.g. share links opening
    // a new tab, downloads). Failures are intentionally swallowed — tracking
    // must never affect the user flow.
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Never let analytics break the product.
  }
}
