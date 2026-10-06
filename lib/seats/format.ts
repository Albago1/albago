import type { ReservationStatus, SeatRef } from './types'

// Pure display helpers shared by the event-page panel, My Seats, the admin
// console and the emails.

export function formatMoney(cents: number, currency: string, locale = 'en-GB'): string {
  const amount = cents / 100
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

/** Collapses consecutive numbers: [7,8,9,12] → "7–9, 12". */
export function compressNumbers(numbers: number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b)
  const parts: string[] = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const n = sorted[i]
    if (n === prev + 1) {
      prev = n
      continue
    }
    if (start !== undefined) parts.push(start === prev ? `${start}` : `${start}–${prev}`)
    start = n
    prev = n
  }
  return parts.join(', ')
}

export type SeatGroupLabel = {
  area: string
  block: string
  row: string
  seats: string
}

/** Groups seats by area/block/row: "Nord-Tribüne Oberrang · Block 114 ·
 *  Row 22 · Seats 7–9". Labels stay in the stadium's own language (they match
 *  what the buyer will see in the Eventim app). */
export function groupSeats(seats: SeatRef[]): SeatGroupLabel[] {
  const groups = new Map<string, { area: string; block: string; row: string; numbers: number[] }>()
  for (const seat of seats) {
    const key = `${seat.area}|${seat.block}|${seat.row}`
    const group = groups.get(key)
    if (group) group.numbers.push(seat.seat)
    else groups.set(key, { area: seat.area, block: seat.block, row: seat.row, numbers: [seat.seat] })
  }
  return [...groups.values()].map((g) => ({
    area: g.area,
    block: g.block,
    row: g.row,
    seats: compressNumbers(g.numbers),
  }))
}

/** One line per group, for emails and CSV. */
export function seatsLine(seats: SeatRef[], words = { block: 'Block', row: 'Row', seats: 'Seats' }): string {
  return groupSeats(seats)
    .map((g) =>
      [g.area, g.block !== '-' ? `${words.block} ${g.block}` : null, `${words.row} ${g.row}`, `${words.seats} ${g.seats}`]
        .filter(Boolean)
        .join(' · '),
    )
    .join(' | ')
}

/** The buyer-facing journey. Terminal off-ramps (cancelled/expired/refunded)
 *  are shown as a note instead of a step. */
export const RESERVATION_STEPS = ['held', 'paid', 'transfer_sent', 'delivered'] as const

export function stepIndex(status: ReservationStatus): number {
  return (RESERVATION_STEPS as readonly string[]).indexOf(status)
}

export function isActiveReservation(status: ReservationStatus): boolean {
  return stepIndex(status) >= 0
}

/** A held reservation past its expiry is effectively gone even before the
 *  database sweep flips it — show it that way. */
export function effectiveStatus(
  status: ReservationStatus,
  expiresAt: string | null,
  now = Date.now(),
): ReservationStatus {
  if (status === 'held' && expiresAt && Date.parse(expiresAt) <= now) return 'expired'
  return status
}

/** RFC 4180 cell so commas, quotes and newlines survive Excel. */
export function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

/** "450" / "450,00" / "450.5" / "€450" → cents; null for empty or invalid. */
export function parseEuroToCents(input: string): number | null {
  const cleaned = input.replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (!cleaned) return null
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}
