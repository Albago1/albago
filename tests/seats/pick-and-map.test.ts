import { describe, expect, it } from 'vitest'
import { freeInBlock, maxTogetherInBlock, pickSeats } from '@/lib/seats/pick'
import { normalizeBlock, placeBlock, venueMapById, venueMapFor } from '@/lib/seats/venueMaps'
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

  it('places every block of the real stock', () => {
    const map = venueMapById('merkur-spiel-arena-boxing')!
    for (const run of RUNS) {
      expect(placeBlock(map, run.area, run.block), `${run.area} ${run.block}`).not.toBeNull()
    }
  })

  it('draws bowl blocks as paths and floor blocks as rects', () => {
    const map = venueMapById('merkur-spiel-arena-boxing')!
    expect(placeBlock(map, OBER, '114')?.d).toMatch(/^M/)
    expect(placeBlock(map, 'Innenraum', '204')?.rect).toBeDefined()
    expect(placeBlock(map, 'Süd-Tribüne Unterrang', '40')).toBeNull()
  })

  it('normalises block spellings', () => {
    expect(normalizeBlock('20 A')).toBe('20A')
    expect(normalizeBlock('20a')).toBe('20A')
  })
})
