import { OFFICIAL_SHOP_URL } from '@/lib/hysa/event'
import type { Side } from '@/lib/seats/venueMaps'

/**
 * Stadium guides: AlbaGo's own venue drawing as an interactive guide for an
 * event whose tickets are sold ONLY on the official shop. Tapping a block
 * explains where it is and sends the visitor to the official seat map —
 * AlbaGo never sells, prices or reserves anything here, and never reads the
 * official shop (it blocks automated access; we respect that).
 */

export type OfficialSeatGuide = {
  venueMapId: string
  /** The stand the community's fan channel sells (highlighted). */
  fanStand: { sides: Side[]; name: string; fighter: string; flag: string }
  /** Official shop channels. `fans` covers the fan stand and the floor; `main` the rest. */
  channels: { fans: string; main: string }
  /** Promoter, shown as the seller. */
  promoter: string
  /**
   * Optional snapshot of blocks where seats were seen free in each channel,
   * entered by hand from screenshots of the official shop (never fetched).
   * Shown as "seen free" marks until it is older than SEEN_MAX_DAYS.
   */
  seen?: { at: string; fans: string[]; main: string[] }
}

/** A snapshot older than this stops showing — stale marks would mislead. */
export const SEEN_MAX_DAYS = 7

/** Queensberry's main channel for the same event (Kabayel fans / every area). */
export const QUEENSBERRY_SHOP_URL = 'https://www.ticket-onlineshop.com/ols/queensberry/en/tickets/channel/shop/areaplan/venue/event/696488'

export const OFFICIAL_GUIDES: Record<string, OfficialSeatGuide> = {
  // Agit Kabayel vs Nelson Hysa — Merkur Spiel-Arena, 28 Nov 2026.
  'ca279183-362c-41dc-beea-9be8340a55b6': {
    venueMapId: 'merkur-spiel-arena-boxing',
    fanStand: { sides: ['L', 'TL', 'BL'], name: 'Nord-Tribüne', fighter: 'Hysa', flag: '🇦🇱' },
    channels: { fans: OFFICIAL_SHOP_URL, main: QUEENSBERRY_SHOP_URL },
    promoter: 'Queensberry',
    // From the organiser's screenshots of both channels, 23 Oct 2026 19:47 Berlin.
    seen: {
      at: '2026-10-23T19:47:00+02:00',
      fans: ['125', '126', '127', '128', '129', '130', '131', '132', '19', '20A', '20B', '21', '201', '202', '203', '205', '206', '207', '208', '210', '211', '223', '224'],
      main: ['37', '38', '152', '153', '154', '155'],
    },
  },
}

export function officialGuideFor(eventId: string): OfficialSeatGuide | null {
  return OFFICIAL_GUIDES[eventId] ?? null
}
