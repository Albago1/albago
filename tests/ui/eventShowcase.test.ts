import { describe, expect, it } from 'vitest'
import {
  SHOWCASES,
  formatEuro,
  formatShowcaseDate,
  questionWhatsAppHref,
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
    expect(xmas.organizerLogo).toMatch(/adhr-logo\.png$/)
    expect(showcaseForEvent('00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  it('has one entry per event', () => {
    const ids = SHOWCASES.map((s) => s.eventId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('formats euros the way each language writes them', () => {
    expect(formatEuro(6000, 'en-GB')).toBe('€60')
    expect(formatEuro(12000, 'de-DE')).toBe('120 €')
    expect(formatEuro(1250, 'de-DE')).toBe('12,50 €')
  })

  it('writes an Albanian reservation request with blanks for party size and name', () => {
    const text = reservationMessage(xmas, 'sq', '25 dhjetor, 20:00')
    expect(text).toBe(
      [
        'Përshëndetje ADHR Events!',
        'Dua të rezervoj për Merry Christmas Berlin (25 dhjetor, 20:00).',
        '',
        'Numri i personave:',
        'Emri:',
        '',
        '(E gjeta në AlbaGo)',
      ].join('\n'),
    )
  })

  it('links straight to the organizer on WhatsApp with the request filled in', () => {
    const href = reservationWhatsAppHref(xmas, 'de', '25. Dezember, 20:00')!
    expect(href.startsWith('https://wa.me/4917664016246?text=')).toBe(true)
    const text = decodeURIComponent(href.split('?text=')[1])
    expect(text).toContain('Ich möchte für Merry Christmas Berlin (25. Dezember, 20:00) reservieren.')
    expect(text).toContain('Anzahl Personen:')
  })

  it('opens a question chat from the contact card', () => {
    const href = questionWhatsAppHref(xmas, 'en', '25 December, 20:00')!
    const text = decodeURIComponent(href.split('?text=')[1])
    expect(text.startsWith('Hi ADHR Events! I have a question about Merry Christmas Berlin (25 December, 20:00):')).toBe(true)
    expect(text).toContain('(Found it on AlbaGo)')
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
