// Team Hysa landing page (phase 44) — the facts the page states, in one
// place. Every number here was checked against a public source on the date
// in `verifiedAt`; anything not verified (start time, prices) is left out on
// purpose. The official ticket channel stays the source of truth for prices
// and availability: AlbaGo only links into it.

export const HYSA_LANGS = ['sq', 'de', 'en'] as const
export type HysaLang = (typeof HYSA_LANGS)[number]

export const HYSA_PATH = '/hysa'

/** Page path for a language (Albanian is the default at /hysa). */
export const hysaPath = (lang: HysaLang) => (lang === 'sq' ? HYSA_PATH : `${HYSA_PATH}/${lang}`)

/** Official Nelson Hysa ticket channel — the exact area plan / seat map. */
export const OFFICIAL_SHOP_URL =
  'https://www.ticket-onlineshop.com/ols/nelson-hysa/de/tickets/channel/shop/areaplan/venue/event/696488'

export const HYSA_EVENT = {
  /** Fight night; the official start time isn't published yet, so date only. */
  date: '2026-11-28',
  /** Countdown target: the start of fight day in Düsseldorf (CET, UTC+1). */
  countdownTo: '2026-11-28T00:00:00+01:00',
  venue: {
    name: 'MERKUR SPIEL-ARENA',
    city: 'Düsseldorf',
    country: 'DE',
    street: 'Arena-Straße 1',
    postalCode: '40474',
    lat: 51.2617,
    lng: 6.7331,
  },
  broadcaster: 'DAZN',
  promoter: 'Queensberry',
  title: 'WBC Heavyweight World Championship',
  verifiedAt: '2026-10-10',
  sources: [
    'https://queensberry.co.uk/pages/agit-kabayel-vs-nelson-hysa-bad-blood',
    'https://ringside24.com/en/news/boxing/259062-agit-kabayel-vs-nelson-hysa-set-for-nov-28-in-dusseldorf-unbeaten-heavyweights-collide-with-big-stakes',
    'https://www.ringmagazine.com/news/wbc-elevates-agit-kabayel-to-full-heavyweight-champion-1mchpqqElIOl4TyrlOGazl',
    'https://www.visitduesseldorf.de/informieren/anreise/merkur-spiel-arena',
  ],
} as const

export type Fighter = {
  name: string
  flag: string
  /** Translation key for the country. */
  countryKey: 'albania' | 'germany'
  wins: number
  losses: number
  kos: number
  /** Translation key for the title / standing line. */
  roleKey: 'challenger' | 'champion'
  hometown?: string
  nickname?: string
}

export const FIGHTERS: { hysa: Fighter; kabayel: Fighter } = {
  hysa: {
    name: 'Nelson Hysa',
    flag: '🇦🇱',
    countryKey: 'albania',
    wins: 25,
    losses: 0,
    kos: 23,
    roleKey: 'challenger',
    hometown: 'Shkodër',
    nickname: 'The Albanian Eagle',
  },
  kabayel: {
    name: 'Agit Kabayel',
    flag: '🇩🇪',
    countryKey: 'germany',
    wins: 27,
    losses: 0,
    kos: 19,
    roleKey: 'champion',
  },
}

export type CategoryId = 'cat4' | 'cat6' | 'cat8'

export type HysaCategory = {
  id: CategoryId
  /** As printed on the official tickets. */
  name: string
  /** Area on the official tickets of this channel. */
  area: string
  /** Map tier: -1 floor, 0 lower tier, 1 upper tier (lib/seats/venueMaps). */
  tier: -1 | 0 | 1
  color: string
  /** Official price in cents with the date it was checked, or null = not shown. */
  officialPrice: { cents: number; checkedAt: string } | null
}

// Area ↔ category from real tickets bought through the Nelson Hysa channel.
export const CATEGORIES: HysaCategory[] = [
  { id: 'cat8', name: 'CAT 8', area: 'Nord-Tribüne Oberrang', tier: 1, color: '#f87171', officialPrice: null },
  { id: 'cat6', name: 'CAT 6', area: 'Nord-Tribüne Unterrang', tier: 0, color: '#ee1c25', officialPrice: null },
  { id: 'cat4', name: 'CAT 4', area: 'Innenraum', tier: -1, color: '#fafafa', officialPrice: null },
]
