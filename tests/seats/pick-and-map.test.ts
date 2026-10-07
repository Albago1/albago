import { describe, expect, it } from 'vitest'
import {
  bestKeysInBlock,
  freeInBlock,
  maxTogetherInBlock,
  parseSeatKey,
  pickSeats,
  rowsOf,
  seatKeyOf,
} from '@/lib/seats/pick'
import { allBlocks, findBlock, normalizeBlock, venueMapById, venueMapFor } from '@/lib/seats/venueMaps'
import { layoutBlock } from '@/lib/seats/seatLayout'
import type { FreeRun, PublicSeat } from '@/lib/seats/types'

// The real 37-seat stock as free runs (what seat_sale_public returns before
// any sale). The same scenarios are asserted against the SQL in
// scripts/seat-sql-test.mjs — the preview must agree with seat_pick.
const OBER = 'Nord-Tribüne Oberrang'
const UNTER = 'Nord-Tribüne Unterrang'
const RUNS: FreeRun[] = [
  { category: 'Cat 4', area: 'Innenraum', block: '204', row: '1', first: 14, len: 4 },
  { category: 'Cat 8', area: OBER, block: '114', row: '22', first: 7, len: 7 },
  { category: 'Cat 8', area: OBER, block: '114', row: '23', first: 10, len: 3 },
  { category: 'Cat 8', area: OBER, block: '115', row: '20', first: 4, len: 2 },
  { category: 'Cat 8', area: OBER, block: '125', row: '20', first: 1, len: 5 },
  { category: 'Cat 8', area: OBER, block: '125', row: '20', first: 15, len: 3 },
  { category: 'Cat 6', area: UNTER, block: '12', row: '18', first: 14, len: 4 },
  { category: 'Cat 6', area: UNTER, block: '18', row: '17', first: 5, len: 2 },
  { category: 'Cat 6', area: UNTER, block: '20 A', row: '9', first: 7, len: 4 },
  { category: 'Cat 6', area: UNTER, block: '20 B', row: '10', first: 7, len: 3 },
]

const where = (p: ReturnType<typeof pickSeats>) =>
  p ? `${p.block}/${p.row}/${p.seats.join(',')}` : null

describe('pickSeats (mirror of the seat_pick RPC)', () => {
  it('a pair takes the exact-fit pair', () => {
    expect(where(pickSeats(RUNS, 'Cat 8', 2))).toBe('115/20/4,5')
  })

  it('a trio takes the first exact-fit trio', () => {
    expect(where(pickSeats(RUNS, 'Cat 8', 3))).toBe('114/23/10,11,12')
  })

  it('a single takes the smallest run that still leaves two together', () => {
    const without = RUNS.filter((r) => !(r.block === '115'))
    expect(where(pickSeats(without, 'Cat 8', 1))).toBe('114/23/10')
  })

  it('a group of 7 takes the 7-run', () => {
    expect(where(pickSeats(RUNS, 'Cat 8', 7))).toBe('114/22/7,8,9,10,11,12,13')
  })

  it('returns null when no run is long enough', () => {
    expect(pickSeats(RUNS, 'Cat 6', 5)).toBeNull()
  })

  it('stays inside a block chosen on the map', () => {
    expect(where(pickSeats(RUNS, 'Cat 6', 2, { area: UNTER, block: '20 A' }))).toBe('20 A/9/7,8')
    expect(where(pickSeats(RUNS, 'Cat 6', 2, { area: UNTER, block: '20 B' }))).toBe('20 B/10/7,8')
    expect(pickSeats(RUNS, 'Cat 6', 3, { area: UNTER, block: '18' })).toBeNull()
  })

  it('reports per-block capacity for the map', () => {
    expect(maxTogetherInBlock(RUNS, { area: OBER, block: '125' })).toBe(5)
    expect(freeInBlock(RUNS, { area: OBER, block: '125' })).toBe(8)
    expect(freeInBlock(RUNS, { area: OBER, block: '999' })).toBe(0)
  })
})

describe('venue map', () => {
  it('recognises the Merkur Spiel-Arena from the event text', () => {
    expect(venueMapFor(['Kabayel vs Hysa', 'Merkur Spiel-Arena', null])?.id).toBe('merkur-spiel-arena-boxing')
    expect(venueMapFor([null, null, 'Arena-Straße 1, 40474 Düsseldorf'])?.id).toBe('merkur-spiel-arena-boxing')
    expect(venueMapFor(['Some club night', 'Kino Berlin'])).toBeNull()
  })

  it('draws the whole venue: upper tier 101–164 once each, floor 200–237', () => {
    const map = venueMapById('merkur-spiel-arena-boxing')!
    const blocks = allBlocks(map)
    const upper = blocks.filter((b) => b.tier === 1).map((b) => b.label)
    expect(upper).toHaveLength(64)
    expect(new Set(upper).size).toBe(64)
    expect([...upper].map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => 101 + i))
    const floor = blocks.filter((b) => b.tier === -1).map((b) => Number(b.label))
    expect([...floor].sort((a, b) => a - b)).toEqual(Array.from({ length: 38 }, (_, i) => 200 + i))
    const lower = blocks.filter((b) => b.tier === 0)
    expect(lower).toHaveLength(54)
    expect(lower.map((b) => b.label)).toEqual(expect.arrayContaining(['11A', '12', '19', '20A', '20B', '21', '33B', '41', '42B', '44']))
  })

  it('finds every block of the real stock on the map', () => {
    const map = venueMapById('merkur-spiel-arena-boxing')!
    const blocks = allBlocks(map)
    for (const run of RUNS) {
      expect(findBlock(map, blocks, run.area, run.block), `${run.area} ${run.block}`).not.toBeNull()
    }
    expect(findBlock(map, blocks, OBER, '114')?.d).toMatch(/^M/)
    expect(findBlock(map, blocks, 'Innenraum', '204')?.rect).toBeDefined()
    expect(findBlock(map, blocks, 'Süd-Tribüne Unterrang', '40')).toBeNull()
  })

  it('puts the Nord-Tribüne blocks on the left, 204 on the floor near the ring', () => {
    const map = venueMapById('merkur-spiel-arena-boxing')!
    const blocks = allBlocks(map)
    const at = (area: string, block: string) => findBlock(map, blocks, area, block)!
    expect(at(OBER, '125').cx).toBeLessThan(map.field.x0)
    expect(at(UNTER, '12').cx).toBeLessThan(map.field.x0)
    expect(at(UNTER, '12').cy).toBeGreaterThan(at(UNTER, '18').cy) // 12 below 18
    const b204 = at('Innenraum', '204')
    expect(b204.cx).toBeGreaterThan(map.ring.cx)
    expect(b204.cy).toBeLessThan(map.ring.cy)
  })

  it('normalises block spellings', () => {
    expect(normalizeBlock('20 A')).toBe('20A')
    expect(normalizeBlock('20a')).toBe('20A')
  })
})

describe('exact seats (block close-up)', () => {
  it('round-trips a seat key, even with spaces in the block', () => {
    const seat = { area: UNTER, block: '20 A', row: '9', seat: 7 }
    expect(parseSeatKey(seatKeyOf(seat))).toEqual(seat)
  })

  it('lays a block out front row first, with gaps where numbering jumps', () => {
    const seats = [
      { row: '20', seat: 16 },
      { row: '20', seat: 2 },
      { row: '20', seat: 1 },
      { row: '20', seat: 15 },
      { row: '9', seat: 4 },
    ]
    const rows = rowsOf(seats)
    expect(rows.map((r) => r.row)).toEqual(['9', '20'])
    expect(rows[1].seats.map((s) => [s.seat, s.gapBefore])).toEqual([
      [1, false],
      [2, false],
      [15, true],
      [16, false],
    ])
  })

  it('pre-selects the best seats inside the opened block', () => {
    expect(bestKeysInBlock(RUNS, 'Cat 8', 2, { area: OBER, block: '125' })).toEqual([
      seatKeyOf({ area: OBER, block: '125', row: '20', seat: 1 }),
      seatKeyOf({ area: OBER, block: '125', row: '20', seat: 2 }),
    ])
  })

  it('shrinks the pre-selection to what fits together in the block', () => {
    expect(bestKeysInBlock(RUNS, 'Cat 6', 5, { area: UNTER, block: '18' })).toHaveLength(2)
    expect(bestKeysInBlock(RUNS, 'Cat 6', 2, { area: UNTER, block: '999' })).toEqual([])
  })
})

describe('seats drawn on the map', () => {
  const map = venueMapById('merkur-spiel-arena-boxing')!
  const blocks = allBlocks(map)
  const seatsOf = (area: string, block: string): PublicSeat[] =>
    RUNS.filter((r) => r.area === area && r.block === block).flatMap((r) =>
      Array.from({ length: r.len }, (_, i) => ({
        category: r.category,
        area: r.area,
        block: r.block,
        row: r.row,
        seat: r.first + i,
        free: true,
      })),
    )
  const shapeOf = (area: string, block: string) => findBlock(map, blocks, area, block)!
  const layoutOf = (area: string, block: string) => layoutBlock(map, shapeOf(area, block), seatsOf(area, block))
  const inside = (b: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number) =>
    x >= b.x0 - 0.01 && x <= b.x1 + 0.01 && y >= b.y0 - 0.01 && y <= b.y1 + 0.01

  it('places every one of our seats exactly once, at its row and seat number', () => {
    for (const run of RUNS) {
      const layout = layoutOf(run.area, run.block)
      const ours = layout.seats.filter((s) => s.seat)
      expect(ours).toHaveLength(seatsOf(run.area, run.block).length)
      for (const s of ours) {
        expect(s.row).toBe(String(Number(s.seat!.row)))
        expect(s.n).toBe(s.seat!.seat)
      }
    }
  })

  it('keeps the seats inside their block on the map', () => {
    for (const run of RUNS) {
      const shape = shapeOf(run.area, run.block)
      for (const s of layoutOf(run.area, run.block).seats) {
        expect(inside(shape.box, s.x, s.y), `${run.block} r${s.row} s${s.n}`).toBe(true)
      }
    }
  })

  it('fills a straight bowl block with a typical tier: 26 rows × 24 seats upstairs', () => {
    const layout = layoutOf(OBER, '125')
    const rows = new Set(layout.seats.map((s) => s.row))
    expect(rows.size).toBe(26)
    expect(layout.seats.filter((s) => s.row === '1')).toHaveLength(24)
    expect(layout.rowLabels).toHaveLength(26 * 2)
  })

  it('runs rows along the field edge, row 1 nearest the field', () => {
    // Block 125 is on the left straight: the field is to the right (larger x).
    const layout = layoutOf(OBER, '125')
    const x1 = layout.seats.find((s) => s.row === '1')!.x
    const x20 = layout.seats.find((s) => s.row === '20')!.x
    expect(x1).toBeGreaterThan(x20)
    // Seats of one row line up along the side (same x).
    const row20 = layout.seats.filter((s) => s.row === '20')
    expect(Math.max(...row20.map((s) => s.x)) - Math.min(...row20.map((s) => s.x))).toBeLessThan(0.01)
  })

  it('faces the floor rows toward the ring', () => {
    // 204 sits above the ring: row 1 is its bottom row.
    const layout = layoutOf('Innenraum', '204')
    const y1 = layout.seats.find((s) => s.row === '1')!.y
    const yMax = Math.max(...layout.seats.map((s) => s.y))
    expect(y1).toBeCloseTo(yMax, 5)
    expect(layout.seats.filter((s) => s.seat).map((s) => s.n)).toEqual([14, 15, 16, 17])
  })

  it('gives corner rows more seats toward the back', () => {
    const shape = shapeOf(UNTER, '20 A')
    const layout = layoutBlock(map, shape, [])
    const count = (row: string) => layout.seats.filter((s) => s.row === row).length
    expect(count('20')).toBeGreaterThan(count('5'))
  })

  it('flies to the middle of our free seats', () => {
    const layout = layoutOf(OBER, '115')
    const ours = layout.seats.filter((s) => s.seat)
    expect(layout.focus.x).toBeCloseTo((ours[0].x + ours[1].x) / 2, 3)
    expect(layout.focus.y).toBeCloseTo((ours[0].y + ours[1].y) / 2, 3)
  })

  it('draws a block without our seats as grey seats only', () => {
    const empty = layoutBlock(map, blocks.find((b) => b.label === '140')!, [])
    expect(empty.seats.every((s) => s.seat === null)).toBe(true)
    expect(empty.others.length).toBeGreaterThan(0)
  })
})
