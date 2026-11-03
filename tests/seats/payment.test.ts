import { describe, expect, it } from 'vitest'
import {
  epcPayload,
  isValidBic,
  isValidIban,
  isValidPaypalMe,
  maskIban,
  normalizePaypalMe,
  paypalMeUrl,
} from '@/lib/seats/payment'

describe('IBAN', () => {
  it('accepts valid IBANs, with or without spaces and in any case', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true)
    expect(isValidIban('de89 3704 0044 0532 0130 00')).toBe(true)
    expect(isValidIban('AL47212110090000000235698741')).toBe(true)
  })
  it('rejects a wrong checksum or shape', () => {
    expect(isValidIban('DE88370400440532013000')).toBe(false)
    expect(isValidIban('1234')).toBe(false)
    expect(isValidIban('')).toBe(false)
  })
  it('masks all but the country, check digits and last four', () => {
    expect(maskIban('DE89 3704 0044 0532 0130 00')).toBe('DE89 •••• •••• 3000')
  })
})

describe('BIC and PayPal.me', () => {
  it('validates BICs', () => {
    expect(isValidBic('COBADEFFXXX')).toBe(true)
    expect(isValidBic('cobadeff')).toBe(true)
    expect(isValidBic('COBA')).toBe(false)
  })
  it('accepts a PayPal.me name or link', () => {
    expect(normalizePaypalMe('https://www.paypal.com/paypalme/AlbaGo')).toBe('AlbaGo')
    expect(normalizePaypalMe('paypal.me/AlbaGo/10')).toBe('AlbaGo')
    expect(isValidPaypalMe('paypal.me/AlbaGo')).toBe(true)
    expect(isValidPaypalMe('has space')).toBe(false)
  })
  it('builds a PayPal.me link with the amount', () => {
    expect(paypalMeUrl('AlbaGo', 15800)).toBe('https://paypal.me/AlbaGo/158.00EUR')
  })
})

describe('GiroCode (EPC) payload', () => {
  it('follows EPC069-12 version 002 line by line', () => {
    const lines = epcPayload({
      holder: 'Test Person',
      iban: 'de89 3704 0044 0532 0130 00',
      amountCents: 15800,
      remittance: 'KH-4821',
    }).split('\n')
    expect(lines).toEqual(['BCD', '002', '1', 'SCT', '', 'Test Person', 'DE89370400440532013000', 'EUR158.00', '', '', 'KH-4821'])
  })
  it('keeps name and reference within the standard limits', () => {
    const lines = epcPayload({ holder: 'x'.repeat(90), iban: 'DE89370400440532013000', bic: 'cobadeff', amountCents: 1, remittance: 'r'.repeat(200) }).split('\n')
    expect(lines[4]).toBe('COBADEFF')
    expect(lines[5]).toHaveLength(70)
    expect(lines[7]).toBe('EUR0.01')
    expect(lines[10]).toHaveLength(140)
  })
})
