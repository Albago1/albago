import { afterEach, describe, expect, it, vi } from 'vitest'
import { berlinDay, summarizeHysa, type HysaRow } from '@/lib/hysa/analytics'
import { getAvailability, normalizeFeed } from '@/lib/hysa/availability'
import { HYSA_COPY } from '@/lib/hysa/copy'
import { CATEGORIES, hysaPath, OFFICIAL_SHOP_URL } from '@/lib/hysa/event'
import { hysaEventSchema, hysaMetadata } from '@/lib/hysa/metadata'

const row = (over: Partial<HysaRow>): HysaRow => ({
  type: 'page_view',
  session_id: 's1',
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  referrer: null,
  platform: null,
  metadata: { campaign: 'hysa', lang: 'sq' },
  created_at: '2026-10-10T10:00:00Z',
  path: '/hysa',
  ...over,
})

describe('Team Hysa analytics', () => {
  const rows: HysaRow[] = [
    row({ session_id: 'a', utm_source: 'nelson_hysa', utm_medium: 'instagram', utm_campaign: 'duesseldorf' }),
    row({ session_id: 'a', type: 'ticket_category_view', metadata: { category: 'cat6' } }),
    row({ session_id: 'a', type: 'ticket_category_click', metadata: { category: 'cat6' } }),
    row({ session_id: 'b', metadata: { lang: 'de' }, referrer: 'https://www.tiktok.com/@x', created_at: '2026-10-10T23:30:00Z' }),
    row({ session_id: 'b', type: 'language_changed', metadata: { from: 'de', to: 'sq' } }),
    row({ session_id: 'c', created_at: '2026-10-11T08:00:00Z' }),
    row({ session_id: 'c', type: 'seat_map_click' }),
    row({ session_id: 'c', type: 'share_whatsapp', platform: 'whatsapp' }),
  ]
  const s = summarizeHysa(rows)

  it('counts visitors, ticket clicks and CTR by session', () => {
    expect(s.visitors).toBe(3)
    expect(s.ticketClicks).toBe(2)
    expect(s.clickers).toBe(2)
    expect(s.ctr).toBeCloseTo(2 / 3)
  })

  it('attributes sources by first touch (UTM, referrer host, direct)', () => {
    const bySource = Object.fromEntries(s.sources.map((x) => [x.source, x]))
    expect(bySource['nelson_hysa']).toMatchObject({ visitors: 1, clickers: 1 })
    expect(bySource['ref: tiktok.com']).toMatchObject({ visitors: 1, clickers: 0 })
    expect(bySource['direct']).toMatchObject({ visitors: 1, clickers: 1 })
    expect(s.campaigns).toEqual([
      expect.objectContaining({ source: 'nelson_hysa', medium: 'instagram', campaign: 'duesseldorf', visitors: 1, clicks: 1 }),
    ])
  })

  it('splits categories, languages, shares and days (Berlin time)', () => {
    expect(s.categories.find((c) => c.category === 'cat6')).toEqual({ category: 'cat6', clicks: 1, views: 1 })
    expect(s.languages).toEqual(expect.arrayContaining([{ lang: 'sq', visitors: 2 }, { lang: 'de', visitors: 1 }]))
    expect(s.languageChanges).toBe(1)
    expect(s.shares.find((x) => x.type === 'share_whatsapp')?.count).toBe(1)
    // 23:30 UTC on the 10th is already the 11th in Berlin.
    expect(berlinDay('2026-10-10T23:30:00Z')).toBe('2026-10-11')
    expect(s.daily.map((d) => d.day)).toEqual(['2026-10-10', '2026-10-11'])
  })
})

describe('official availability feed', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('is "not_configured" without an official feed — nothing is fetched', async () => {
    vi.stubEnv('HYSA_AVAILABILITY_FEED_URL', '')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const data = await getAvailability()
    expect(data.status).toBe('not_configured')
    expect(data.lastUpdated).toBeNull()
    expect(data.categories.every((c) => c.availability === 'unknown' && c.officialUrl === OFFICIAL_SHOP_URL)).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('normalizes a valid feed and drops junk values', () => {
    const at = new Date('2026-10-10T19:34:00Z')
    const data = normalizeFeed(
      {
        categories: [
          { id: 'cat8', price: 79, availability: 'available', availableCount: 120, blocks: ['114', 7] },
          { id: 'cat6', price: -5, availability: 'nearly-gone' },
          { id: 'cat99', availability: 'available' },
        ],
      },
      at,
    )!
    expect(data.status).toBe('live')
    expect(data.lastUpdated).toBe('2026-10-10T19:34:00.000Z')
    const byId = Object.fromEntries(data.categories.map((c) => [c.id, c]))
    expect(byId.cat8).toMatchObject({ price: 79, availability: 'available', availableCount: 120, blocks: ['114'] })
    expect(byId.cat6).toMatchObject({ price: null, availability: 'unknown' })
    expect(byId.cat4.availability).toBe('unknown')
    expect(normalizeFeed({ nope: true }, at)).toBeNull()
  })
})

describe('page content and SEO', () => {
  it('has complete copy in all three languages', () => {
    const shape = (o: unknown): unknown =>
      Array.isArray(o) ? o.length : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)])) : typeof o
    expect(shape(HYSA_COPY.de)).toEqual(shape(HYSA_COPY.sq))
    expect(shape(HYSA_COPY.en)).toEqual(shape(HYSA_COPY.sq))
    expect(HYSA_COPY.sq.tickets.purchaseNote).toBe('Biletat përfundimtare blihen përmes sistemit zyrtar të eventit.')
  })

  it('never states a price that was not checked', () => {
    for (const c of CATEGORIES) expect(c.officialPrice === null || !!c.officialPrice.checkedAt).toBe(true)
  })

  it('links every language version and points the offer at the official channel', () => {
    const meta = hysaMetadata('de')
    expect(meta.alternates?.canonical).toMatch(/\/hysa\/de$/)
    expect(Object.keys(meta.alternates?.languages ?? {})).toEqual(['sq', 'de', 'en', 'x-default'])
    expect(hysaPath('sq')).toBe('/hysa')
    const schema = hysaEventSchema('sq')
    expect(schema['@type']).toBe('SportsEvent')
    expect(schema.startDate).toBe('2026-11-28')
    expect(schema.offers.url).toBe(OFFICIAL_SHOP_URL)
    expect(JSON.stringify(schema)).not.toMatch(/"seller"|AlbaGo/)
  })
})
