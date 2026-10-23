import { OFFICIAL_SHOP_URL } from '@/lib/hysa/event'
import type { MapBlock, Side } from '@/lib/seats/venueMaps'

/**
 * Stadium guides: AlbaGo's own venue drawing as an interactive guide for an
 * event whose tickets are sold ONLY on the official shop. The arena is split
 * into the two fighters' sides; tapping a block explains where it is and
 * sends the visitor to that side's official shop — AlbaGo never sells,
 * prices or reserves anything here, and never reads the official shop (it
 * blocks automated access; we respect that).
 */

export type GuideSide = {
  key: string
  name: string
  fullName: string
  /** Albanian genitive for "Ana e …" ("Hysës"); falls back to the name. */
  sqGenitive?: string
  flag: string
  color: string
  /** e.g. "25-0 · 23 KO" */
  record: string
  role: 'champion' | 'challenger'
  photo?: string
  /** Proper name of the side's stand; none = "the rest of the arena". */
  stand?: string
  /** Official shop channel for this side. */
  shop: string
  /** Bowl sides that belong to this side… */
  bowl: Side[]
  /** …plus single blocks the side's channel also sells. */
  extra?: string[]
}

export type OfficialSeatGuide = {
  venueMapId: string
  /** Promoter, shown as the seller. */
  promoter: string
  /** [left of the map, right of the map]. */
  sides: [GuideSide, GuideSide]
  /** The floor around the ring: neither side's, sold through `shop`. */
  ringside: { color: string; shop: string }
  /**
   * Optional snapshot of the blocks that had free seats, entered by hand from
   * screenshots of the official shop (never fetched). While fresh, these show
   * in colour and every other block as sold out; after SEEN_MAX_DAYS the map
   * falls back to plain side colours.
   */
  seen?: { at: string; blocks: string[] }
}

/** A snapshot older than this stops showing — stale availability would mislead. */
export const SEEN_MAX_DAYS = 7

/** Queensberry's main channel for the same event (every area). */
export const QUEENSBERRY_SHOP_URL = 'https://www.ticket-onlineshop.com/ols/queensberry/en/tickets/channel/shop/areaplan/venue/event/696488'

export const OFFICIAL_GUIDES: Record<string, OfficialSeatGuide> = {
  // Agit Kabayel vs Nelson Hysa — Merkur Spiel-Arena, 28 Nov 2026.
  'ca279183-362c-41dc-beea-9be8340a55b6': {
    venueMapId: 'merkur-spiel-arena-boxing',
    promoter: 'Queensberry',
    sides: [
      {
        key: 'hysa',
        name: 'Hysa',
        fullName: 'Nelson Hysa',
        sqGenitive: 'Hysës',
        flag: '🇦🇱',
        color: '#ee1c25',
        record: '25-0 · 23 KO',
        role: 'challenger',
        photo: 'https://queensberry.co.uk/cdn/shop/files/Nelson_Hysa_4.jpg?v=1749635769&width=480',
        stand: 'Nord-Tribüne',
        shop: OFFICIAL_SHOP_URL,
        bowl: ['L', 'TL', 'BL'],
        // The Hysa channel's plan also sells these, next to the corner.
        extra: ['131', '132', '21'],
      },
      {
        key: 'kabayel',
        name: 'Kabayel',
        fullName: 'Agit Kabayel',
        sqGenitive: 'Kabayelit',
        flag: '🇩🇪',
        color: '#3b82f6',
        record: '27-0 · 19 KO',
        role: 'champion',
        photo: 'https://queensberry.co.uk/cdn/shop/files/Agit_Kabayel_2.jpg?v=1749719130&width=480',
        shop: QUEENSBERRY_SHOP_URL,
        bowl: ['T', 'TR', 'R', 'BR', 'B'],
      },
    ],
    ringside: { color: '#f5c542', shop: OFFICIAL_SHOP_URL },
    // From the organiser's screenshots of both channels, 23 Oct 2026 19:47 Berlin
    // (blocks with a clear run of free seats; lone single seats left out).
    seen: {
      at: '2026-10-23T19:47:00+02:00',
      blocks: [
        ...['125', '126', '127', '128', '129', '130', '131', '132', '19', '20A', '20B', '21'],
        ...['37', '38', '152', '153', '154', '155'],
        ...['201', '202', '203', '205', '206', '207', '208', '210', '211', '223', '224'],
      ],
    },
  },
}

export function officialGuideFor(eventId: string): OfficialSeatGuide | null {
  return OFFICIAL_GUIDES[eventId] ?? null
}

/** The snapshot while it is fresh enough to show, else null. */
export function freshSnapshot(guide: OfficialSeatGuide, now = Date.now()): OfficialSeatGuide['seen'] | null {
  const at = guide.seen ? Date.parse(guide.seen.at) : NaN
  return guide.seen && now - at < SEEN_MAX_DAYS * 86_400_000 ? guide.seen : null
}

/** Which side a bowl position belongs to (unnamed blocks included). */
export function memberOf(guide: OfficialSeatGuide, label: string | null, side: Side | undefined): 0 | 1 | null {
  const extra = label ? guide.sides.findIndex((s) => s.extra?.includes(label)) : -1
  if (extra === 0 || extra === 1) return extra
  const bowl = guide.sides.findIndex((s) => !!side && s.bowl.includes(side))
  return bowl === 0 || bowl === 1 ? bowl : null
}

/** Which side a block is sold on: 0 or 1, 'ring' for the floor, null if unnamed. */
export function sideOfBlock(guide: OfficialSeatGuide, b: MapBlock): 0 | 1 | 'ring' | null {
  if (!b.label) return null
  return b.tier === -1 ? 'ring' : memberOf(guide, b.label, b.side)
}
