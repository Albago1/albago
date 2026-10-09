// Aggregates for the /admin/hysa dashboard (phase 44), computed from raw
// interactions rows. Pure so it can be unit-tested.

export type HysaRow = {
  type: string
  session_id: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
  platform: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  path: string | null
}

export const OUTBOUND_TYPES = ['official_shop_click', 'ticket_category_click', 'seat_map_click', 'group_ticket_click'] as const
const SHARE_TYPES = ['share_whatsapp', 'share_facebook', 'share_copy_link'] as const

const meta = (r: HysaRow, key: string): string | null => {
  const v = r.metadata?.[key]
  return typeof v === 'string' && v ? v : null
}

function hostOf(referrer: string | null): string | null {
  if (!referrer) return null
  try {
    return new URL(referrer).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Day key in Berlin time (the fight's city; the user's dashboard zone). */
export function berlinDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

export function summarizeHysa(rows: HysaRow[]) {
  const outbound = new Set<string>(OUTBOUND_TYPES)
  const sessions = new Map<string, { firstSource: string; campaignKey: string; campaign: { source: string; medium: string; campaign: string; content: string }; lang: string | null; clicked: boolean }>()

  // First touch per session decides its source / campaign.
  for (const r of rows) {
    if (!sessions.has(r.session_id)) {
      const source = r.utm_source ?? (hostOf(r.referrer) ? `ref: ${hostOf(r.referrer)}` : 'direct')
      const c = {
        source: r.utm_source ?? '—',
        medium: r.utm_medium ?? '—',
        campaign: r.utm_campaign ?? '—',
        content: meta(r, 'utm_content') ?? '—',
      }
      sessions.set(r.session_id, {
        firstSource: source,
        campaignKey: `${c.source}|${c.medium}|${c.campaign}|${c.content}`,
        campaign: c,
        lang: null,
        clicked: false,
      })
    }
    const s = sessions.get(r.session_id)!
    if (r.type === 'page_view' && !s.lang) s.lang = meta(r, 'lang')
    if (outbound.has(r.type)) s.clicked = true
  }

  const viewers = new Set(rows.filter((r) => r.type === 'page_view').map((r) => r.session_id))
  const clickers = new Set(rows.filter((r) => outbound.has(r.type)).map((r) => r.session_id))
  const visitors = viewers.size

  const count = (pred: (r: HysaRow) => boolean) => rows.filter(pred).length

  // Daily trend.
  const dayMap = new Map<string, { visitors: Set<string>; clicks: number }>()
  for (const r of rows) {
    const day = berlinDay(r.created_at)
    const d = dayMap.get(day) ?? { visitors: new Set<string>(), clicks: 0 }
    if (r.type === 'page_view') d.visitors.add(r.session_id)
    if (outbound.has(r.type)) d.clicks += 1
    dayMap.set(day, d)
  }
  const daily = [...dayMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, d]) => ({ day, visitors: d.visitors.size, clicks: d.clicks }))

  // Sources (first touch).
  const srcMap = new Map<string, { visitors: number; clickers: number }>()
  for (const [sid, s] of sessions) {
    if (!viewers.has(sid)) continue
    const e = srcMap.get(s.firstSource) ?? { visitors: 0, clickers: 0 }
    e.visitors += 1
    if (s.clicked) e.clickers += 1
    srcMap.set(s.firstSource, e)
  }
  const sources = [...srcMap.entries()].map(([source, e]) => ({ source, ...e })).sort((a, b) => b.visitors - a.visitors)

  // Campaigns (UTM-tagged first touches only).
  const cmpMap = new Map<string, { source: string; medium: string; campaign: string; content: string; visitors: number; clicks: number }>()
  for (const [sid, s] of sessions) {
    if (s.campaign.source === '—' && s.campaign.medium === '—' && s.campaign.campaign === '—') continue
    const e = cmpMap.get(s.campaignKey) ?? { ...s.campaign, visitors: 0, clicks: 0 }
    if (viewers.has(sid)) e.visitors += 1
    cmpMap.set(s.campaignKey, e)
  }
  for (const r of rows) {
    if (!outbound.has(r.type)) continue
    const s = sessions.get(r.session_id)
    const e = s ? cmpMap.get(s.campaignKey) : undefined
    if (e) e.clicks += 1
  }
  const campaigns = [...cmpMap.entries()].map(([key, e]) => ({ key, ...e })).sort((a, b) => b.visitors - a.visitors)

  // Categories.
  const categories = ['cat8', 'cat6', 'cat4'].map((category) => ({
    category,
    clicks: count((r) => r.type === 'ticket_category_click' && meta(r, 'category') === category),
    views: count((r) => r.type === 'ticket_category_view' && meta(r, 'category') === category),
  }))

  // Languages (sessions by the language of their first page view).
  const langMap = new Map<string, number>()
  for (const [sid, s] of sessions) {
    if (!viewers.has(sid)) continue
    const key = s.lang ?? 'unknown'
    langMap.set(key, (langMap.get(key) ?? 0) + 1)
  }
  const languages = [...langMap.entries()].map(([lang, n]) => ({ lang, visitors: n })).sort((a, b) => b.visitors - a.visitors)

  return {
    visitors,
    pageViews: count((r) => r.type === 'page_view'),
    ticketClicks: count((r) => outbound.has(r.type)),
    clickers: [...clickers].filter((sid) => viewers.has(sid)).length,
    ctr: visitors ? [...clickers].filter((sid) => viewers.has(sid)).length / visitors : 0,
    daily,
    sources,
    campaigns,
    categories,
    languages,
    languageChanges: count((r) => r.type === 'language_changed'),
    clickTypes: OUTBOUND_TYPES.map((type) => ({ type, count: count((r) => r.type === type) })),
    shares: [...SHARE_TYPES.map((type) => ({ type, count: count((r) => r.type === type) })), { type: 'native share', count: count((r) => r.type === 'share_click' && r.platform === 'native') }],
  }
}
