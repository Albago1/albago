// Stadium maps for seat sales (phase 43). AlbaGo's own drawing — not the
// venue's or ticket seller's artwork — built from the real block layout of
// the official event plan: every block in its real order and position, so the
// map reads like the ones on Eventim / Queensberry.
//
// Geometry: the bowl is drawn around the field rectangle. Each tier is a band
// at an offset from the field; a block is a slice of a band, given by its side
// (straight or corner) and its index on that side. Sides run clockwise
// starting at the bottom end of the left straight:
//   L (up) → TL corner → T (right) → TR corner → R (down) → BR corner →
//   B (left) → BL corner.
// Floor blocks are rectangles at their real positions around the ring.

export type Side = 'L' | 'TL' | 'T' | 'TR' | 'R' | 'BR' | 'B' | 'BL'

export const SIDES: Side[] = ['L', 'TL', 'T', 'TR', 'R', 'BR', 'B', 'BL']

export type TierDef = {
  /** Matches the tier part of a seat's area, e.g. /unterrang/i. */
  match: RegExp
  inner: number
  outer: number
  /** Block labels per side, in clockwise order; null = a block we draw but
   *  can't name with certainty. Array length = number of blocks on the side. */
  sides: Record<Side, Array<string | null>>
}

export type FloorBlockDef = { x: number; y: number; w: number; h: number }

export type Rect = { x0: number; y0: number; x1: number; y1: number }

export type VenueMap = {
  id: string
  name: string
  viewBox: { w: number; h: number }
  field: Rect
  /** Label along the left side (the stand the stock is in). */
  leftStandLabel: string
  /** Matches the stand part of the area for blocks in the bowl. */
  standMatch: RegExp
  floorMatch: RegExp
  tiers: TierDef[]
  floorBlocks: Record<string, FloorBlockDef>
  ring: { cx: number; cy: number; size: number }
  /** Ringside area (the floor gap the ringside rows frame). */
  ringside: FloorBlockDef
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i))

const nulls = (n: number): null[] => Array.from({ length: n }, () => null)

// Floor blocks: [x, y, w, h] in map units, converted from the official plan.
const MERKUR_FLOOR: Record<string, [number, number, number, number]> = {
  '200': [166.4, 103.1, 15.9, 11.2], '201': [184.2, 103.1, 15.9, 11.2],
  '202': [201.8, 103.1, 15.9, 11.2], '203': [219.4, 103.1, 15.9, 11.2],
  '204': [237.2, 103.1, 15.9, 11.2], '205': [166.4, 116.5, 15.8, 13.8],
  '206': [184.2, 116.5, 15.8, 13.8], '207': [201.8, 116.5, 15.8, 13.8],
  '208': [219.4, 116.5, 15.8, 13.8], '209': [261.7, 126.8, 13, 18.2],
  '210': [261.7, 147.6, 13, 18.2], '211': [244.2, 147.6, 13, 18.2],
  '212': [267.3, 183.6, 16.2, 20.4], '213': [250, 183.6, 16.2, 20.4],
  '214': [232.9, 183.6, 16.2, 20.4], '215': [197.3, 209.9, 18.5, 6.9],
  '216': [183.3, 209.9, 11.4, 7], '217': [125.1, 177.8, 16.2, 18.2],
  '218': [125.1, 156.4, 16.2, 18.2], '219': [125.1, 135.1, 16.2, 18.2],
  '220': [144.4, 177.8, 13, 18.2], '221': [144.4, 156.4, 13, 18.2],
  '222': [144.4, 135.1, 13, 18.2], '223': [125.1, 106.4, 12.2, 19.8],
  '224': [136, 106.4, 12.2, 19.8], '225': [146.7, 116.8, 8.1, 9.4],
  '226': [197.3, 195.4, 18.3, 9.9], '227': [183.3, 195.4, 11.2, 9.9],
  '228': [166.4, 163.6, 9.5, 18.3], '229': [166.4, 141.9, 9.5, 18.3],
  '230': [197.2, 185.1, 18.6, 5.5], '231': [183.2, 185.1, 11.5, 5.4],
  '232': [183.1, 163.3, 5.6, 15.7], '233': [183, 144.2, 5.6, 15.7],
  '234': [183.6, 136.5, 13.9, 5.6], '235': [199.3, 136.5, 18.6, 5.5],
  '236': [219.4, 136.5, 13.9, 5.6], '237': [236, 147.4, 5.3, 18.6],
}

/** Merkur Spiel-Arena, Düsseldorf — boxing configuration (ring on the floor).
 *  Nord-Tribüne on the left, as on the official Kabayel vs Hysa plan. Block
 *  order and counts follow that plan: upper tier 101–164 in one clockwise
 *  loop, lower tier 11A–44 (the box/press section on the far side unnamed). */
const MERKUR_SPIEL_ARENA_BOXING: VenueMap = {
  id: 'merkur-spiel-arena-boxing',
  name: 'Merkur Spiel-Arena',
  viewBox: { w: 406, h: 322 },
  field: { x0: 101, y0: 89, x1: 316.6, y1: 232.4 },
  leftStandLabel: 'Nord-Tribüne',
  standMatch: /nord/i,
  floorMatch: /innenraum|floor|parkett/i,
  tiers: [
    {
      match: /unterrang/i,
      inner: 0,
      outer: 38,
      sides: {
        L: range(12, 19),
        TL: ['20A', '20B'],
        T: range(21, 32),
        TR: ['33A', '33B'],
        R: range(34, 41),
        BR: ['42A', '42B'],
        // right → left: 43, 44, 1, the box/press section, then 8, 9, 10
        B: ['43', '44', '1', ...nulls(12), '8', '9', '10'],
        BL: ['11A', '11B'],
      },
    },
    {
      match: /oberrang/i,
      inner: 38,
      outer: 79,
      sides: {
        L: range(118, 125),
        TL: range(126, 130),
        T: range(131, 144),
        TR: range(145, 149),
        R: range(150, 157),
        BR: range(158, 162),
        B: ['163', '164', ...range(101, 112)],
        BL: range(113, 117),
      },
    },
  ],
  floorBlocks: Object.fromEntries(
    Object.entries(MERKUR_FLOOR).map(([label, [x, y, w, h]]) => [label, { x, y, w, h }]),
  ),
  ring: { cx: 212.3, cy: 163.5, size: 24 },
  ringside: { x: 188.7, y: 142, w: 47.3, h: 43.1 },
}

const MAPS = [MERKUR_SPIEL_ARENA_BOXING]

/** Picks a map from what the event page knows about the venue. */
export function venueMapFor(text: Array<string | null | undefined>): VenueMap | null {
  const haystack = text.filter(Boolean).join(' ').toLowerCase()
  if (/merkur[\s-]*spiel[\s-]*arena|esprit[\s-]*arena|arena[\s-]*stra(ß|ss)e\s*1\b/.test(haystack)) {
    return MERKUR_SPIEL_ARENA_BOXING
  }
  return null
}

export function venueMapById(id: string): VenueMap | null {
  return MAPS.find((m) => m.id === id) ?? null
}

/** "20 A" → "20A" so seat-list spellings match the map. */
export function normalizeBlock(block: string): string {
  return block.replace(/\s+/g, '').toUpperCase()
}

// ---- geometry ---------------------------------------------------------------

// Rounded: trig on the server and in the browser can differ in the last
// digit, which React reports as a hydration mismatch.
const r2 = (n: number) => Math.round(n * 100) / 100

type Pt = [number, number]

/** Point on `side` at fraction f (clockwise), offset d from the field. */
function pointOn(field: Rect, side: Side, f: number, d: number): Pt {
  const { x0, y0, x1, y1 } = field
  const W = x1 - x0
  const H = y1 - y0
  const arc = (cx: number, cy: number, from: number): Pt => {
    const t = from + f * (Math.PI / 2)
    return [cx + d * Math.cos(t), cy + d * Math.sin(t)]
  }
  switch (side) {
    case 'L':
      return [x0 - d, y1 - f * H]
    case 'TL':
      return arc(x0, y0, Math.PI)
    case 'T':
      return [x0 + f * W, y0 - d]
    case 'TR':
      return arc(x1, y0, (3 * Math.PI) / 2)
    case 'R':
      return [x1 + d, y0 + f * H]
    case 'BR':
      return arc(x1, y1, 0)
    case 'B':
      return [x1 - f * W, y1 + d]
    case 'BL':
      return arc(x0, y1, Math.PI / 2)
  }
}

const isCorner = (side: Side) => side.length === 2
const fmt = (p: Pt) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`

/** SVG path for the slice [f0, f1] of a side, between offsets a and b. */
export function slicePath(field: Rect, side: Side, f0: number, f1: number, a: number, b: number): string {
  const i0 = pointOn(field, side, f0, a)
  const o0 = pointOn(field, side, f0, b)
  const o1 = pointOn(field, side, f1, b)
  const i1 = pointOn(field, side, f1, a)
  if (!isCorner(side)) return `M${fmt(i0)} L${fmt(o0)} L${fmt(o1)} L${fmt(i1)} Z`
  // A corner slice with inner offset 0 is a wedge out of the field corner.
  if (a === 0) return `M${fmt(i0)} L${fmt(o0)} A${b} ${b} 0 0 1 ${fmt(o1)} Z`
  return `M${fmt(i0)} L${fmt(o0)} A${b} ${b} 0 0 1 ${fmt(o1)} L${fmt(i1)} A${a} ${a} 0 0 0 ${fmt(i0)} Z`
}

function sliceCenter(field: Rect, side: Side, f0: number, f1: number, a: number, b: number): Pt {
  // Corner wedges from the field corner read better labelled out toward the rim.
  const d = isCorner(side) && a === 0 ? b * 0.62 : (a + b) / 2
  const [x, y] = pointOn(field, side, (f0 + f1) / 2, d)
  return [r2(x), r2(y)]
}

export type MapBlock = {
  /** Block label as on the map ("114", "20A") or null for an unnamed block. */
  label: string | null
  /** Tier index in `map.tiers`, or -1 for the floor. */
  tier: number
  d?: string
  rect?: FloorBlockDef
  cx: number
  cy: number
  /** Rough size, for zooming the map onto the block. */
  size: number
}

/** Every block of the venue — bowl and floor — for drawing the full map. */
export function allBlocks(map: VenueMap): MapBlock[] {
  const blocks: MapBlock[] = []
  map.tiers.forEach((tier, t) => {
    for (const side of SIDES) {
      const labels = tier.sides[side]
      const n = labels.length
      labels.forEach((label, i) => {
        const [cx, cy] = sliceCenter(map.field, side, i / n, (i + 1) / n, tier.inner, tier.outer)
        blocks.push({
          label,
          tier: t,
          d: slicePath(map.field, side, i / n, (i + 1) / n, tier.inner, tier.outer),
          cx,
          cy,
          size: tier.outer - tier.inner,
        })
      })
    }
  })
  for (const [label, rect] of Object.entries(map.floorBlocks)) {
    blocks.push({
      label,
      tier: -1,
      rect,
      cx: r2(rect.x + rect.w / 2),
      cy: r2(rect.y + rect.h / 2),
      size: Math.max(rect.w, rect.h),
    })
  }
  return blocks
}

/** The map block a stock block (area + block from the seat list) sits in,
 *  or null when the map doesn't know it (it is then listed, not drawn). */
export function findBlock(map: VenueMap, blocks: MapBlock[], area: string, block: string): MapBlock | null {
  const label = normalizeBlock(block)
  if (map.floorMatch.test(area)) {
    return blocks.find((b) => b.tier === -1 && b.label === label) ?? null
  }
  if (!map.standMatch.test(area)) return null
  const tier = map.tiers.findIndex((t) => t.match.test(area))
  if (tier < 0) return null
  return blocks.find((b) => b.tier === tier && b.label === label) ?? null
}
