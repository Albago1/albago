import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  normalizeCategory,
  parseEventimSeats,
  splitAreaBlock,
  suggestCategories,
} from '@/lib/seats/parseEventimSeats'
import {
  compressNumbers,
  effectiveStatus,
  formatMoney,
  groupSeats,
  parseEuroToCents,
  seatsLine,
  stepIndex,
  toCsv,
} from '@/lib/seats/format'

// The real Eventim "My tickets" copy for the Kabayel vs Hysa stock (37 seats).
const PASTE = readFileSync(path.join(import.meta.dirname, 'eventim-paste.txt'), 'utf8')

describe('parseEventimSeats', () => {
  it('reads all 37 seats from the Eventim copy, with categories', () => {
    const result = parseEventimSeats(PASTE)
    expect(result.problems).toEqual([])
    expect(result.duplicates).toBe(0)
    expect(result.seats).toHaveLength(37)
    const count = (cat: string) => result.seats.filter((s) => s.category === cat).length
    expect(count('Cat 4')).toBe(4)
    expect(count('Cat 6')).toBe(13)
    expect(count('Cat 8')).toBe(20)
  })

  it('splits area and block the way the stadium labels them', () => {
    const { seats } = parseEventimSeats(PASTE)
    expect(seats[0]).toEqual({ category: 'Cat 4', area: 'Innenraum', block: '204', row: '1', seat: 14 })
    expect(seats.find((s) => s.block === '20 A')).toMatchObject({
      area: 'Nord-Tribüne Unterrang',
      row: '9',
      seat: 7,
    })
  })

  it('counts a pasted-twice list as duplicates, not new seats', () => {
    const result = parseEventimSeats(`${PASTE}\n${PASTE}`)
    expect(result.seats).toHaveLength(37)
    expect(result.duplicates).toBe(37)
  })

  it('accepts a category on the same line (table copies)', () => {
    const result = parseEventimSeats('Innenraum 204, Reihe 1, Platz 14\tCat 4\tEinzelticket')
    expect(result.seats).toEqual([
      { category: 'Cat 4', area: 'Innenraum', block: '204', row: '1', seat: 14 },
    ])
  })

  it('reports seats with no category and unreadable seat-like lines', () => {
    const result = parseEventimSeats(
      'Innenraum 204, Reihe 1, Platz 14\nInnenraum 204, Reihe 1, Platz 15\nCat 4\nBlock 9 Reihe ? Platz x7',
    )
    expect(result.seats).toHaveLength(1)
    expect(result.seats[0].seat).toBe(15)
    expect(result.problems).toHaveLength(2)
  })

  it('normalizes German/English category spellings', () => {
    expect(normalizeCategory('Kat. 4')).toBe('Cat 4')
    expect(normalizeCategory('Kategorie 12')).toBe('Cat 12')
    expect(normalizeCategory('cat 8')).toBe('Cat 8')
    expect(normalizeCategory('Einzelticket')).toBeNull()
  })

  it('handles areas without a block number', () => {
    expect(splitAreaBlock('Stehplatz Innenraum')).toEqual({ area: 'Stehplatz Innenraum', block: '-' })
  })

  it('suggests one category per code labelled with its area', () => {
    expect(suggestCategories(parseEventimSeats(PASTE).seats)).toEqual([
      { code: 'Cat 4', label: 'Innenraum', count: 4 },
      { code: 'Cat 8', label: 'Nord-Tribüne Oberrang', count: 20 },
      { code: 'Cat 6', label: 'Nord-Tribüne Unterrang', count: 13 },
    ])
  })
})

describe('seat formatting', () => {
  it('compresses consecutive seat numbers', () => {
    expect(compressNumbers([9, 7, 8, 12])).toBe('7–9, 12')
    expect(compressNumbers([5])).toBe('5')
    expect(compressNumbers([])).toBe('')
  })

  it('groups seats by row for display', () => {
    const seats = [
      { area: 'Nord-Tribüne Oberrang', block: '114', row: '22', seat: 7 },
      { area: 'Nord-Tribüne Oberrang', block: '114', row: '22', seat: 8 },
      { area: 'Innenraum', block: '204', row: '1', seat: 14 },
    ]
    expect(groupSeats(seats)).toEqual([
      { area: 'Nord-Tribüne Oberrang', block: '114', row: '22', seats: '7–8' },
      { area: 'Innenraum', block: '204', row: '1', seats: '14' },
    ])
    expect(seatsLine(seats)).toBe(
      'Nord-Tribüne Oberrang · Block 114 · Row 22 · Seats 7–8 | Innenraum · Block 204 · Row 1 · Seats 14',
    )
  })

  it('formats euros without needless decimals', () => {
    expect(formatMoney(45000, 'EUR')).toBe('€450')
    expect(formatMoney(45050, 'EUR')).toBe('€450.50')
  })

  it('parses admin price input', () => {
    expect(parseEuroToCents('450')).toBe(45000)
    expect(parseEuroToCents('€ 450,50')).toBe(45050)
    expect(parseEuroToCents('1.750')).toBe(175000)
    expect(parseEuroToCents('1.750,00')).toBe(175000)
    expect(parseEuroToCents('')).toBeNull()
    expect(parseEuroToCents('abc')).toBeNull()
  })

  it('treats a lapsed hold as expired before the sweep runs', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(effectiveStatus('held', past)).toBe('expired')
    expect(effectiveStatus('held', future)).toBe('held')
    expect(effectiveStatus('paid', past)).toBe('paid')
  })

  it('orders the buyer journey', () => {
    expect(stepIndex('held')).toBe(0)
    expect(stepIndex('delivered')).toBe(3)
    expect(stepIndex('refunded')).toBe(-1)
  })

  it('escapes CSV cells', () => {
    expect(toCsv(['a', 'b'], [['x, y', 'say "hi"']])).toBe('"a","b"\r\n"x, y","say ""hi"""')
  })
})
