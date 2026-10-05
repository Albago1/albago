import { describe, expect, it } from 'vitest'
import { compactPrice, displayPrice } from '@/lib/ticketDisplay'

describe('displayPrice', () => {
  it('hides placeholders importers leave behind', () => {
    for (const value of ['Unknown', 'unknown', ' TBA ', 'tbd', 'N/A', '—', '-', '?', 'Price unknown']) {
      expect(displayPrice(value)).toBeNull()
    }
  })

  it('hides empty values', () => {
    expect(displayPrice(null)).toBeNull()
    expect(displayPrice(undefined)).toBeNull()
    expect(displayPrice('   ')).toBeNull()
  })

  it('keeps real prices, trimmed', () => {
    expect(displayPrice(' €22 ')).toBe('€22')
    expect(displayPrice('Free')).toBe('Free')
    expect(displayPrice('Phase 1 Pre-sale Ticket 1,000 lekë')).toBe('Phase 1 Pre-sale Ticket 1,000 lekë')
  })
})

describe('compactPrice', () => {
  it('pulls the amount out of a long label', () => {
    expect(compactPrice('Phase 1 Pre-sale Ticket 1,000 lekë')).toBe('1,000 lekë')
    expect(compactPrice('Early bird tickets from €25 online')).toBe('€25')
    expect(compactPrice('Entry at the door 500 ALL')).toBe('500 ALL')
    expect(compactPrice('Regular entry ALL 2,000 per person')).toBe('ALL 2,000')
  })

  it('leaves short labels alone', () => {
    expect(compactPrice('€22')).toBe('€22')
    expect(compactPrice('From ALL 5,000')).toBe('From ALL 5,000')
    expect(compactPrice('Free')).toBe('Free')
  })

  it('leaves long labels with no amount alone', () => {
    expect(compactPrice('Free entry before midnight')).toBe('Free entry before midnight')
  })

  it('does not stop a currency word inside a longer word', () => {
    expect(compactPrice('Tickets 300 allocated, 20 EUR each')).toBe('20 EUR')
  })
})
