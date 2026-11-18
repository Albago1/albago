import { describe, expect, it } from 'vitest'
import {
  SHOWCASES,
  formatEuro,
  formatShowcaseDate,
  partyTotalCents,
  reservationMessage,
  reservationWhatsAppHref,
  showcaseForEvent,
  telHref,
} from '@/lib/eventShowcase'

const xmas = showcaseForEvent('33ed35f3-7c45-44ff-9845-a6d5b8c04938')!

describe('event showcase', () => {
  it('finds the Christmas night by event id, and nothing for other events', () => {
    expect(xmas.name).toBe('Merry Christmas Berlin')
    expect(xmas.admission.priceCents).toBe(6000)
    expect(xmas.admission.kidsFreeUpToAge).toBe(8)
    expect(showcaseForEvent('00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  it('has one entry per event', () => {
    const ids = SHOWCASES.map((s) => s.eventId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('charges paying guests only — kids 8 and under are free', () => {
    expect(partyTotalCents(6000, 1)).toBe(6000)
    expect(partyTotalCents(6000, 2)).toBe(12000)
    expect(partyTotalCents(6000, 0)).toBe(0)
  })

  it('formats euros the way each language writes them', () => {
    expect(formatEuro(6000, 'en-GB')).toBe('€60')
    expect(formatEuro(12000, 'de-DE')).toBe('120 €')
    expect(formatEuro(1250, 'de-DE')).toBe('12,50 €')
  })

  it('writes the Albanian reservation with guests, free kids and the total', () => {
    const text = reservationMessage(xmas, 'sq', '25 dhjetor, 20:00', 2, 1)
    expect(text).toContain('Përshëndetje ADHR Events!')
    expect(text).toContain('Merry Christmas Berlin (25 dhjetor, 20:00)')
    expect(text).toContain('2 të rritur (60 € secili)')
    expect(text).toContain('1 fëmijë deri 8 vjeç (falas)')
    expect(text).toContain('Totali: 120 €')
    expect(text).toContain('Emri:')
  })

  it('leaves the kids line out when no kids come', () => {
    const text = reservationMessage(xmas, 'en', '25 December, 20:00', 1, 0)
    expect(text).toContain('1 adult (€60 each)')
    expect(text).not.toContain('child')
    expect(text).toContain('Total: €60')
  })

  it('links straight to the organizer on WhatsApp with the message filled in', () => {
    const href = reservationWhatsAppHref(xmas, 'de', '25. Dezember, 20:00', 3, 2)!
    expect(href.startsWith('https://wa.me/4917664016246?text=')).toBe(true)
    const text = decodeURIComponent(href.split('?text=')[1])
    expect(text).toContain('3 Erwachsene (je 60 €)')
    expect(text).toContain('2 Kinder bis 8 Jahre (frei)')
    expect(text).toContain('Gesamt: 180 €')
  })

  it('writes Albanian dates by hand, whatever the browser knows', () => {
    expect(formatShowcaseDate('2026-12-25', 'sq')).toBe('25 dhjetor')
    expect(formatShowcaseDate('2026-12-25', 'sq', true)).toBe('E premte, 25 dhjetor')
    expect(formatShowcaseDate('2026-12-25', 'de', true)).toBe('Freitag, 25. Dezember')
    expect(formatShowcaseDate('2026-12-25', 'en')).toBe('25 December')
  })

  it('dials the reservation line', () => {
    expect(telHref('+49 176 64016246')).toBe('tel:+4917664016246')
  })
})
