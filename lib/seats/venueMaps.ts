// Simplified stadium maps for seat sales (phase 43). AlbaGo's own drawing —
// not the venue's artwork — with block positions taken from the official
// event plan, so a buyer sees roughly where their block is.
//
// Geometry: the bowl is drawn around the floor rectangle. Each tier is a band
// at an offset from the floor; a block is a slice of a band, given by its
// side (straight or corner) and the fraction of that side it covers.
// Sides run clockwise starting at the bottom end of the left straight:
//   L (up) → TL corner → T (right) → TR corner → R (down) → BR corner →
//   B (left) → BL corner.

export type Side = 'L' | 'TL' | 'T' | 'TR' | 'R' | 'BR' | 'B' | 'BL'

export type TierDef = {
  /** Matches the tier part of a seat's area, e.g. /unterrang/i. */
  match: RegExp
  inner: number
  outer: number
  /** Background cells per side (cosmetic — the real blocks drawn in a lighter grey). */
  cells: Record<Side, number>
  /** Real positions of named blocks: side + cell index on that side. */
  blocks: Record<string, { side: Side; index: number }>
}

export type FloorBlockDef = { x: number; y: number; w: number; h: number }

export type VenueMap = {
  id: string
  name: string
  /** Label shown along the left side (the stand the stock is in). */
  leftStandLabel: string
  /** Matches the stand part of the area for blocks in the bowl. */
  standMatch: RegExp
  floorMatch: RegExp
  tiers: TierDef[]
  floorBlocks: Record<string, FloorBlockDef>
  ring: { cx: number; cy: number; size: number }
  /** Part of the viewBox to show (zoom on the stand that has the stock);
   *  the cut side fades out. Omit to show the whole stadium. */
  focus?: { x: number; y: number; w: number; h: number; fadeRight?: boolean }
}

// Floor rectangle inside a 360 × 300 viewBox.
export const FLOOR = { x0: 110, y0: 95, x1: 250, y1: 205 }
export const VIEWBOX = { w: 360, h: 300 }

const ALL_SIDES: Side[] = ['L', 'TL', 'T', 'TR', 'R', 'BR', 'B', 'BL']

// Every coordinate is rounded: trig on the server and in the browser can
// differ in the last digit, which React reports as a hydration mismatch.
const r2 = (n: number) => Math.round(n * 100) / 100

/** Official plan floor coordinates (0–10000 space) → our floor rect. */
function floorPoint(px: number, py: number): { x: number; y: number } {
  return { x: r2(118 + ((px - 3600) / 2700) * 124), y: r2(101 + ((py - 3950) / 2150) * 98) }
}

function floorCell(px: number, py: number): FloorBlockDef {
  const { x, y } = floorPoint(px, py)
  return { x: r2(x - 6), y: r2(y - 4.5), w: 12, h: 9 }
}

const OFFICIAL_FLOOR: Record<string, [number, number]> = {
  '201': [4735, 4118], '202': [5050, 4115], '203': [5361, 4113], '204': [5676, 4110],
  '205': [4422, 4372], '206': [4736, 4373], '207': [5047, 4371], '208': [5361, 4370],
  '209': [6079, 4586], '210': [6080, 4953], '211': [5769, 4960],
  '212': [6206, 5602], '213': [5893, 5597], '214': [5593, 5610],
  '215': [4988, 5953], '216': [4681, 5954],
  '217': [3700, 5497], '218': [3706, 5118], '219': [3706, 4744],
  '220': [4013, 5488], '221': [4017, 5113], '222': [4019, 4743],
  '223': [3668, 4247], '224': [3862, 4250], '225': [4016, 4338],
  '226': [4988, 5719], '227': [4683, 5728], '228': [4374, 5237], '229': [4371, 4858],
  '230': [4986, 5508], '231': [4686, 5504], '232': [4637, 5195], '233': [4631, 4870],
  '234': [4713, 4651], '235': [5030, 4651], '236': [5345, 4649], '237': [5562, 4957],
}

/** Merkur Spiel-Arena, Düsseldorf — boxing configuration (ring on the floor).
 *  Nord-Tribüne drawn on the left, as on the official Kabayel vs Hysa plan. */
const MERKUR_SPIEL_ARENA_BOXING: VenueMap = {
  id: 'merkur-spiel-arena-boxing',
  name: 'Merkur Spiel-Arena',
  leftStandLabel: 'Nord-Tribüne',
  standMatch: /nord/i,
  floorMatch: /innenraum|floor|parkett/i,
  tiers: [
    {
      match: /unterrang/i,
      inner: 9,
      outer: 33,
      cells: { L: 8, TL: 2, T: 13, TR: 2, R: 8, BR: 2, B: 20, BL: 2 },
      blocks: {
        '12': { side: 'L', index: 0 },
        '13': { side: 'L', index: 1 },
        '14': { side: 'L', index: 2 },
        '15': { side: 'L', index: 3 },
        '16': { side: 'L', index: 4 },
        '17': { side: 'L', index: 5 },
        '18': { side: 'L', index: 6 },
        '19': { side: 'L', index: 7 },
        '20A': { side: 'TL', index: 0 },
        '20B': { side: 'TL', index: 1 },
        '11B': { side: 'BL', index: 1 },
        '11A': { side: 'BL', index: 0 },
      },
    },
    {
      match: /oberrang/i,
      inner: 38,
      outer: 66,
      cells: { L: 9, TL: 7, T: 11, TR: 5, R: 9, BR: 5, B: 14, BL: 4 },
      blocks: {
        '117': { side: 'L', index: 0 },
        '118': { side: 'L', index: 1 },
        '119': { side: 'L', index: 2 },
        '120': { side: 'L', index: 3 },
        '121': { side: 'L', index: 4 },
        '122': { side: 'L', index: 5 },
        '123': { side: 'L', index: 6 },
        '124': { side: 'L', index: 7 },
        '125': { side: 'L', index: 8 },
        '126': { side: 'TL', index: 0 },
        '127': { side: 'TL', index: 1 },
        '128': { side: 'TL', index: 2 },
        '129': { side: 'TL', index: 3 },
        '130': { side: 'TL', index: 4 },
        '131': { side: 'TL', index: 5 },
        '132': { side: 'TL', index: 6 },
        '113': { side: 'BL', index: 0 },
        '114': { side: 'BL', index: 1 },
        '115': { side: 'BL', index: 2 },
        '116': { side: 'BL', index: 3 },
      },
    },
  ],
  floorBlocks: Object.fromEntries(
    Object.entries(OFFICIAL_FLOOR).map(([label, [px, py]]) => [label, floorCell(px, py)]),
  ),
  // All stock is in the Nord-Tribüne + floor block 204: zoom on the left
  // two thirds so the blocks are big enough to tap on a phone.
  focus: { x: 16, y: 14, w: 240, h: 272, fadeRight: true },
  // The ring sits in the gap the blocks around it leave (233/232 · 234–236 · 237 · 230/231).
  ring: (() => {
    const c = floorPoint(5100, 5080)
    return { cx: c.x, cy: c.y, size: 22 }
  })(),
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

const W = FLOOR.x1 - FLOOR.x0
const H = FLOOR.y1 - FLOOR.y0

type Pt = [number, number]

/** Point on side `side` at fraction f (clockwise), offset d from the floor. */
function pointOn(side: Side, f: number, d: number): Pt {
  const { x0, y0, x1, y1 } = FLOOR
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
export function slicePath(side: Side, f0: number, f1: number, a: number, b: number): string {
  const i0 = pointOn(side, f0, a)
  const o0 = pointOn(side, f0, b)
  const o1 = pointOn(side, f1, b)
  const i1 = pointOn(side, f1, a)
  if (!isCorner(side)) return `M${fmt(i0)} L${fmt(o0)} L${fmt(o1)} L${fmt(i1)} Z`
  return `M${fmt(i0)} L${fmt(o0)} A${b} ${b} 0 0 1 ${fmt(o1)} L${fmt(i1)} A${a} ${a} 0 0 0 ${fmt(i0)} Z`
}

export function sliceCenter(side: Side, f0: number, f1: number, a: number, b: number): Pt {
  const [x, y] = pointOn(side, (f0 + f1) / 2, (a + b) / 2)
  return [r2(x), r2(y)]
}

export type BackgroundCell = { key: string; d: string }

/** Every cosmetic cell of every tier, for the faint bowl. */
export function backgroundCells(map: VenueMap): BackgroundCell[] {
  const cells: BackgroundCell[] = []
  map.tiers.forEach((tier, t) => {
    for (const side of ALL_SIDES) {
      const n = tier.cells[side]
      for (let i = 0; i < n; i++) {
        cells.push({
          key: `${t}-${side}-${i}`,
          d: slicePath(side, i / n, (i + 1) / n, tier.inner, tier.outer),
        })
      }
    }
  })
  return cells
}

export type PlacedBlock = {
  key: string
  /** Shape: an SVG path for bowl blocks, a rect for floor blocks. */
  d?: string
  rect?: FloorBlockDef
  labelX: number
  labelY: number
  label: string
}

/** Where a stock block (area + block from the seat list) sits on the map,
 *  or null when the map doesn't know it (it is then listed, not drawn). */
export function placeBlock(map: VenueMap, area: string, block: string): PlacedBlock | null {
  const label = normalizeBlock(block)
  const key = `${area}|${block}`
  if (map.floorMatch.test(area)) {
    const rect = map.floorBlocks[label]
    if (!rect) return null
    return { key, rect, labelX: r2(rect.x + rect.w / 2), labelY: r2(rect.y + rect.h / 2), label }
  }
  if (!map.standMatch.test(area)) return null
  const tier = map.tiers.find((t) => t.match.test(area))
  const pos = tier?.blocks[label]
  if (!tier || !pos) return null
  const n = tier.cells[pos.side]
  const f0 = pos.index / n
  const f1 = (pos.index + 1) / n
  const [labelX, labelY] = sliceCenter(pos.side, f0, f1, tier.inner, tier.outer)
  return { key, d: slicePath(pos.side, f0, f1, tier.inner, tier.outer), labelX, labelY, label }
}
