import { describe, expect, it } from 'vitest'
import {
  allowedQuantities,
  assignSeats,
  berlinDate,
  bestRun,
  checkSelection,
  phaseOn,
  type RuleContext,
  type SeatPhase,
} from '@/lib/seats/protection'
import type { FreeRun } from '@/lib/seats/types'

const run = (len: number, first = 1, extra: Partial<FreeRun> = {}): FreeRun => ({
  category: 'Cat 8',
  area: 'Nord-Tribüne Oberrang',
  block: '125',
  row: '20',
  first,
  len,
  ...extra,
})
const ctx = (runs: FreeRun[], phase: SeatPhase = 'protected', overrides: RuleContext['overrides'] = []): RuleContext => ({
  phase,
  overrides,
  runs,
  maxPerOrder: 8,
})
const seat = (r: FreeRun, n: number) => ({ area: r.area, block: r.block, row: r.row, seat: n })

// The live stock of 4 Nov 2026 (Block 114 seat 7 kept back, so 8–13 are one group of 6).
const LIVE: FreeRun[] = [
  run(4, 14, { category: 'Cat 6 B12', area: 'Nord-Tribüne Unterrang', block: '12', row: '18' }),
  run(2, 5, { category: 'Cat 6 B18', area: 'Nord-Tribüne Unterrang', block: '18', row: '17' }),
  run(3, 7, { category: 'Cat 6 B20B', area: 'Nord-Tribüne Unterrang', block: '20 B', row: '10' }),
  run(6, 8, { block: '114', row: '22' }),
  run(2, 4, { block: '115', row: '20' }),
  run(5, 1, { block: '125', row: '20' }),
  run(3, 15, { block: '125', row: '20' }),
]

describe('protected phase — quantities per group', () => {
  it.each([
    [2, [2]],
    [3, [1, 3]],
    [4, [1, 2, 4]],
    [5, [1, 2, 3, 5]],
    [6, [1, 2, 3, 4, 6]],
  ])('%i seats → %j', (len, expected) => {
    const r = run(len)
    expect(allowedQuantities(r, ctx([r]))).toEqual(expected)
  })

  it('matches the table for the live stock, group by group', () => {
    const c = ctx(LIVE)
    expect(LIVE.map((r) => allowedQuantities(r, c))).toEqual([[1, 2, 4], [2], [1, 3], [1, 2, 3, 4, 6], [2], [1, 2, 3, 5], [1, 3]])
  })

  it('never offers more than one order may hold', () => {
    const r = run(10)
    expect(allowedQuantities(r, { ...ctx([r]), maxPerOrder: 4 })).toEqual([1, 2, 3, 4])
  })
})

describe('assigning seats', () => {
  it('takes them from one end, so the rest stays together', () => {
    expect(assignSeats(run(3, 7), 1)).toEqual([7])
    expect(assignSeats(run(6, 8), 4)).toEqual([8, 9, 10, 11])
  })
  it('prefers the group that fits exactly, keeping bigger groups for bigger orders', () => {
    const c = ctx(LIVE)
    expect(bestRun(LIVE, 'Cat 8', 2, c)?.block).toBe('115') // the pair, not 2 of the 6
    expect(bestRun(LIVE, 'Cat 8', 3, c)).toMatchObject({ block: '125', first: 15 })
    expect(bestRun(LIVE, 'Cat 8', 4, c)).toMatchObject({ block: '114' }) // 6 → leaves 2
    expect(bestRun(LIVE, 'Cat 6 B20B', 2, c)).toBeNull() // 3 → would strand 1
  })
})

describe('hand-picked selections', () => {
  const g3 = run(3, 7, { block: '20 B', row: '10' })
  const c = ctx([g3])

  it('accepts an end seat or all three', () => {
    expect(checkSelection([seat(g3, 7)], c).ok).toBe(true)
    expect(checkSelection([seat(g3, 9)], c).ok).toBe(true)
    expect(checkSelection([7, 8, 9].map((n) => seat(g3, n)), c).ok).toBe(true)
  })
  it('refuses the middle seat (it would split the group) and says what fits', () => {
    expect(checkSelection([seat(g3, 8)], c)).toMatchObject({ ok: false, reason: 'splits_group', allowed: [1, 3] })
  })
  it('refuses two of three (one seat would be left alone)', () => {
    expect(checkSelection([seat(g3, 7), seat(g3, 8)], c)).toMatchObject({ ok: false, reason: 'strands_seat', allowed: [1, 3] })
  })
  it('refuses seats that are not side by side', () => {
    const g6 = run(6, 8, { block: '114', row: '22' })
    expect(checkSelection([seat(g6, 8), seat(g6, 10)], ctx([g6]))).toMatchObject({ ok: false, reason: 'not_together' })
  })
  it('keeps two groups of the same row apart (125: seats 1–5 and 15–17)', () => {
    const a = run(5, 1)
    const b = run(3, 15)
    const c2 = ctx([a, b])
    expect(checkSelection([seat(a, 5), seat(b, 15)], c2)).toMatchObject({ ok: false, reason: 'not_together' })
    expect(checkSelection([15, 16, 17].map((n) => seat(b, n)), c2).ok).toBe(true)
  })
  it('never offers a seat that is gone', () => {
    // 20B with seat 7 sold: the group is now 8–9.
    const g = run(2, 8, { block: '20 B', row: '10' })
    expect(checkSelection([seat(g, 7)], ctx([g]))).toMatchObject({ ok: false, reason: 'not_together' })
    expect(allowedQuantities(g, ctx([g]))).toEqual([2])
  })
  it('recalculates after a sale', () => {
    // 114: 6 seats → someone takes 2 → 4 left (10–13).
    expect(allowedQuantities(run(6, 8), ctx([run(6, 8)]))).toEqual([1, 2, 3, 4, 6])
    expect(allowedQuantities(run(4, 10), ctx([run(4, 10)]))).toEqual([1, 2, 4])
  })
})

describe('phases', () => {
  const rules = { protect: true, flexible_from: '2026-11-11', final_from: '2026-11-18' }
  it('switch on the Berlin calendar date', () => {
    expect(phaseOn(rules, '2026-11-10')).toBe('protected')
    expect(phaseOn(rules, '2026-11-11')).toBe('flexible')
    expect(phaseOn(rules, '2026-11-17')).toBe('flexible')
    expect(phaseOn(rules, '2026-11-18')).toBe('final')
    expect(phaseOn({ ...rules, protect: false }, '2026-11-01')).toBe('off')
  })
  it('read the date in Berlin, not the server time zone', () => {
    // 23:30 UTC on 10 Nov is already 00:30 on 11 Nov in Berlin (CET, UTC+1).
    expect(berlinDate(new Date('2026-11-10T23:30:00Z'))).toBe('2026-11-11')
    expect(berlinDate(new Date('2026-11-10T22:59:00Z'))).toBe('2026-11-10')
  })
  it('flexible: a lonely seat only when no other group can take the order cleanly', () => {
    const g3 = run(3, 7, { category: 'Cat 6 B20B', block: '20 B', row: '10' })
    // 20B is the only group of its price: 2 of 3 is allowed now.
    expect(allowedQuantities(g3, ctx([g3], 'flexible'))).toEqual([1, 2, 3])
    // Same price elsewhere has a clean fit for 2 (the pair in 115): still refused.
    const pair = run(2, 4, { category: 'Cat 6 B20B', block: '115', row: '20' })
    expect(allowedQuantities(g3, ctx([g3, pair], 'flexible'))).toEqual([1, 3])
  })
  it('flexible still keeps groups together (no middle seat)', () => {
    const g3 = run(3, 7, { block: '20 B', row: '10' })
    expect(checkSelection([seat(g3, 8)], ctx([g3], 'flexible'))).toMatchObject({ ok: false, reason: 'splits_group' })
  })
  it('final: any quantity, seats still side by side', () => {
    const g3 = run(3, 7, { block: '20 B', row: '10' })
    expect(allowedQuantities(g3, ctx([g3], 'final'))).toEqual([1, 2, 3])
    expect(checkSelection([seat(g3, 7), seat(g3, 9)], ctx([g3], 'final'))).toMatchObject({ ok: false, reason: 'not_together' })
  })
})

describe('admin overrides', () => {
  const g4 = run(4, 14, { block: '12', row: '18' })
  const only24 = [{ area: g4.area, block: '12', row: '18', from: 14, to: 17, quantities: [2, 4] }]
  it('limit a group to the chosen quantities', () => {
    expect(allowedQuantities(g4, ctx([g4], 'protected', only24))).toEqual([2, 4])
    expect(checkSelection([seat(g4, 14)], ctx([g4], 'protected', only24))).toMatchObject({ ok: false, reason: 'quantity_not_allowed' })
  })
  it('still apply after part of the group has sold', () => {
    const rest = run(2, 16, { block: '12', row: '18' })
    expect(allowedQuantities(rest, ctx([rest], 'protected', only24))).toEqual([2])
  })
  it('do not touch other groups, and step aside in the final phase', () => {
    const other = run(4, 1, { block: '12', row: '19' })
    expect(allowedQuantities(other, ctx([other], 'protected', only24))).toEqual([1, 2, 4])
    expect(allowedQuantities(g4, ctx([g4], 'final', only24))).toEqual([1, 2, 3, 4])
  })
})
