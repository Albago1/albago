import { describe, expect, it } from 'vitest'
import {
  asWaLang,
  buyerAskMessage,
  buyerPaidMessage,
  normalizeWhatsApp,
  sellerReply,
  waLink,
} from '@/lib/seats/whatsapp'

describe('WhatsApp numbers', () => {
  it('keeps international numbers as digits', () => {
    expect(normalizeWhatsApp('+49 151 2345 6789')).toBe('4915123456789')
    expect(normalizeWhatsApp('0049 (151) 2345-6789')).toBe('4915123456789')
    expect(normalizeWhatsApp('+355 69 123 4567')).toBe('355691234567')
  })
  it('refuses numbers without a country code or junk', () => {
    expect(normalizeWhatsApp('0151 23456789')).toBeNull()
    expect(normalizeWhatsApp('+49 abc')).toBeNull()
    expect(normalizeWhatsApp('+0 1234 5678')).toBeNull()
    expect(normalizeWhatsApp('')).toBeNull()
    expect(normalizeWhatsApp(null)).toBeNull()
  })
  it('builds wa.me links with the message encoded', () => {
    expect(waLink('491512345678', 'Hi & bye?')).toBe('https://wa.me/491512345678?text=Hi%20%26%20bye%3F')
    expect(waLink(null, 'Join me')).toBe('https://wa.me/?text=Join%20me')
  })
})

describe('Messages', () => {
  it('names the picked seats in the question', () => {
    expect(buyerAskMessage('en', { seller: 'AlbaGo', event: 'Kabayel vs Hysa', seats: 'Block 12 · Row 18 · Seats 14–17' })).toBe(
      "Hi AlbaGo! I have a question about the seats for Kabayel vs Hysa. I'm looking at Block 12 · Row 18 · Seats 14–17.",
    )
    expect(buyerAskMessage('sq', { seller: 'AlbaGo', event: 'Kabayel vs Hysa' })).toBe(
      'Përshëndetje AlbaGo! Kam një pyetje për vendet në Kabayel vs Hysa.',
    )
  })
  it('puts everything the seller needs into "I\'ve paid"', () => {
    const msg = buyerPaidMessage('de', {
      seller: 'AlbaGo',
      event: 'Kabayel vs Hysa',
      reference: 'KH-4821',
      amount: '338 €',
      seats: 'Block 12 · Reihe 18 · Plätze 14–15',
      eventimEmail: 'fan@example.com',
    })
    expect(msg.split('\n')).toEqual([
      'Hallo AlbaGo! Ich habe gerade 338 € für die Reservierung KH-4821 (Kabayel vs Hysa) bezahlt.',
      'Plätze: Block 12 · Reihe 18 · Plätze 14–15',
      'Eventim-E-Mail: fan@example.com',
    ])
  })
  it('has a seller reply for every step in every language', () => {
    const d = { name: 'Arben', reference: 'KH-1', event: 'Kabayel vs Hysa', amount: '€79', eventimEmail: 'a@b.c' }
    for (const lang of ['sq', 'de', 'en'] as const) {
      for (const step of ['held', 'paid', 'transfer_sent', 'delivered'] as const) {
        expect(sellerReply(lang, step, d)).toContain('Arben')
      }
    }
  })
  it('falls back to English for unknown languages', () => {
    expect(asWaLang('fr')).toBe('en')
    expect(asWaLang('sq')).toBe('sq')
  })
})
