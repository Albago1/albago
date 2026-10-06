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
import type { FreeRun } from '@/lib/seats/types'

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
