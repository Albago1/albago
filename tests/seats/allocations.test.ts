import { describe, expect, it } from 'vitest'
import {
  allocationTaken,
  consecutiveSeats,
  parseAllocationInput,
  parseAssignedSeats,
  parseBlocks,
} from '@/lib/seats/allocations'

const NOW = Date.parse('2026-11-20T12:00:00Z')
const order = (status: string, quantity: number, expires_at: string | null = null, allocation_id = 'a1') => ({
  allocation_id,
  status: status as never,
  quantity,
  expires_at,
})

describe('allocationTaken', () => {
  it('counts orders past payment as sold and live holds as held', () => {
    const rows = [
      order('paid', 2),
      order('transfer_sent', 1),
      order('delivered', 3),
      order('held', 4, '2026-11-21T00:00:00Z'),
      order('held', 5, '2026-11-20T11:00:00Z'), // lapsed, not swept yet
      order('cancelled', 6),
      order('expired', 7),
      order('refunded', 8),
      order('paid', 9, null, 'other'),
    ]
    expect(allocationTaken('a1', rows, NOW)).toEqual({ sold: 6, held: 4 })
  })

  it('is zero without orders', () => {
    expect(allocationTaken('a1', [], NOW)).toEqual({ sold: 0, held: 0 })
  })
})

describe('parseBlocks', () => {
  it('splits commas and slashes, trims and drops repeats', () => {
    expect(parseBlocks('14, 17')).toEqual(['14', '17'])
    expect(parseBlocks('226 / 228 / 226')).toEqual(['226', '228'])
    expect(parseBlocks(['200'])).toEqual(['200'])
    expect(parseBlocks('')).toEqual([])
  })

  it('rejects junk', () => {
    expect(parseBlocks(42)).toBeNull()
    expect(parseBlocks([1])).toBeNull()
    expect(parseBlocks('x'.repeat(21))).toBeNull()
    expect(parseBlocks(Array.from({ length: 11 }, (_, i) => String(i)))).toBeNull()
  })
})

describe('parseAllocationInput', () => {
  const base = {
    label: 'Block 14 / 17',
    area: 'Nord-Tribüne Unterrang',
    blocks: ['14', '17'],
    rows: '1–5',
    quantity: 20,
    priceCents: 15000,
  }

  it('accepts the seller form', () => {
    expect(parseAllocationInput(base)).toEqual({
      label: 'Block 14 / 17',
      area: 'Nord-Tribüne Unterrang',
      blocks: ['14', '17'],
      rows_label: '1–5',
      quantity: 20,
      price_cents: 15000,
      note: null,
      active: true,
      sort_order: 0,
    })
  })

  it('treats empty rows and note as unknown / none, and keeps paused', () => {
    const v = parseAllocationInput({ ...base, rows: '', note: '  ', active: false, sortOrder: 3 })
    expect(v).toMatchObject({ rows_label: null, active: false, sort_order: 3 })
    expect(parseAllocationInput({ ...base, note: 'VIP benefits to be confirmed' })).toMatchObject({
      note: 'VIP benefits to be confirmed',
    })
  })

  it('names the bad field', () => {
    expect(parseAllocationInput({ ...base, label: ' ' })).toEqual({ error: 'bad_label' })
    expect(parseAllocationInput({ ...base, area: '' })).toEqual({ error: 'bad_area' })
    expect(parseAllocationInput({ ...base, blocks: 5 })).toEqual({ error: 'bad_blocks' })
    expect(parseAllocationInput({ ...base, rows: 'x'.repeat(41) })).toEqual({ error: 'bad_rows' })
    expect(parseAllocationInput({ ...base, quantity: 2.5 })).toEqual({ error: 'bad_quantity' })
    expect(parseAllocationInput({ ...base, quantity: -1 })).toEqual({ error: 'bad_quantity' })
    expect(parseAllocationInput({ ...base, priceCents: '150' })).toEqual({ error: 'bad_price' })
    expect(parseAllocationInput({ ...base, note: 'x'.repeat(201) })).toEqual({ error: 'bad_note' })
    expect(parseAllocationInput({ ...base, sortOrder: 5000 })).toEqual({ error: 'bad_sort' })
  })
})

describe('parseAssignedSeats', () => {
  const seat = (block: string, row: string, n: number) => ({ area: 'Innenraum', block, row, seat: n })

  it('needs exactly the order quantity', () => {
    expect(parseAssignedSeats([seat('200', '2', 1), seat('200', '2', 2)], 2)).toHaveLength(2)
    expect(parseAssignedSeats([seat('200', '2', 1)], 2)).toBeNull()
    expect(parseAssignedSeats([], 0)).toBeNull()
  })

  it('rejects repeats, missing fields and bad seat numbers', () => {
    expect(parseAssignedSeats([seat('200', '2', 1), seat('200', '2', 1)], 2)).toBeNull()
    expect(parseAssignedSeats([{ ...seat('200', '2', 1), block: '' }], 1)).toBeNull()
    expect(parseAssignedSeats([seat('200', '2', 0)], 1)).toBeNull()
    expect(parseAssignedSeats([{ ...seat('200', '2', 1), seat: '1' }], 1)).toBeNull()
    expect(parseAssignedSeats('nope', 1)).toBeNull()
  })
})

describe('consecutiveSeats', () => {
  it('fills side-by-side seats from the first one', () => {
    expect(consecutiveSeats('Innenraum', '213', '4', 7, 3)).toEqual([
      { area: 'Innenraum', block: '213', row: '4', seat: 7 },
      { area: 'Innenraum', block: '213', row: '4', seat: 8 },
      { area: 'Innenraum', block: '213', row: '4', seat: 9 },
    ])
  })
})
