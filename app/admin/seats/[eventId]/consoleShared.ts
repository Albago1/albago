import type {
  PaymentMethod,
  ReservationStatus,
  SeatCategoryRow,
  SeatReservationRow,
  SeatSaleRow,
  SeatStockRow,
  SeatWaitlistRow,
} from '@/lib/seats/types'

export type ConsoleEvent = {
  id: string
  slug: string
  title: string
  date: string
  time: string | null
  status: string
}

export type ConsoleData = {
  event: ConsoleEvent
  sale: SeatSaleRow
  categories: SeatCategoryRow[]
  stock: SeatStockRow[]
  reservations: SeatReservationRow[]
  waitlist: SeatWaitlistRow[]
}

export type ConsoleResult = { ok: boolean; error?: string; [key: string]: unknown }

export async function consoleCall(
  eventId: string,
  method: 'POST' | 'PATCH',
  body: Record<string, unknown>,
): Promise<ConsoleResult> {
  try {
    const res = await fetch(`/api/admin/seats/${eventId}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as ConsoleResult | null
    return json ?? { ok: false, error: `http_${res.status}` }
  } catch {
    return { ok: false, error: 'network' }
  }
}

const ERROR_TEXT: Record<string, string> = {
  forbidden: 'Not authorized — sign in as an admin.',
  seat_taken: 'That seat is attached to a reservation — handle the reservation first.',
  hold_expired: 'This hold expired and its seats went back on sale. Create a manual sale instead.',
  bad_transition: 'That step is not possible from the current status. Refresh and try again.',
  not_together: "Can't seat that many side by side in this category any more.",
  sold_out: 'Not enough free seats in that category.',
  category_not_on_sale: 'That category has no price yet — set one under Stock.',
  bad_details: 'Check the name and email addresses.',
  bad_quantity: 'Check the number of seats.',
  network: 'Could not reach the server.',
}

export function errorText(code: string | undefined): string {
  return (code && ERROR_TEXT[code]) || `Something went wrong (${code ?? 'unknown'}).`
}

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  held: 'Held — awaiting payment',
  paid: 'Paid — to transfer',
  transfer_sent: 'Transfer sent',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  expired: 'Expired',
  refunded: 'Refunded',
}

export const STATUS_BADGE: Record<ReservationStatus, string> = {
  held: 'border-amber-400/35 bg-amber-400/10 text-amber-200',
  paid: 'border-sky-400/35 bg-sky-400/10 text-sky-200',
  transfer_sent: 'border-violet-400/35 bg-violet-400/10 text-violet-200',
  delivered: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200',
  cancelled: 'border-white/15 bg-white/[0.04] text-white/50',
  expired: 'border-white/15 bg-white/[0.04] text-white/50',
  refunded: 'border-white/15 bg-white/[0.04] text-white/60',
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  card: 'Card',
  paypal: 'PayPal',
  stripe: 'Stripe',
  other: 'Other',
}

export type SeatState =
  | 'free'
  | 'unpriced'
  | 'withdrawn'
  | 'held'
  | 'paid'
  | 'transfer_sent'
  | 'delivered'
  | 'refunded_kept'

/** Display mirror of seat_free_stock() for the seat map. The RPCs remain the
 *  only enforcement; this just colours the chips. */
export function seatState(
  seat: SeatStockRow,
  reservations: Map<string, SeatReservationRow>,
  pricedCategories: Set<string>,
  now = Date.now(),
): SeatState {
  const r = seat.reservation_id ? reservations.get(seat.reservation_id) : undefined
  if (r) {
    if (r.status === 'held' && !(r.expires_at && Date.parse(r.expires_at) <= now)) return 'held'
    if (r.status === 'paid' || r.status === 'transfer_sent' || r.status === 'delivered') return r.status
    if (r.status === 'refunded') return 'refunded_kept'
  }
  if (seat.withdrawn) return 'withdrawn'
  return pricedCategories.has(seat.category) ? 'free' : 'unpriced'
}

export const SEAT_CHIP: Record<SeatState, string> = {
  free: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20',
  unpriced: 'border-white/20 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]',
  withdrawn: 'border-dashed border-white/25 bg-transparent text-white/35 hover:bg-white/[0.05]',
  held: 'border-amber-400/45 bg-amber-400/15 text-amber-100',
  paid: 'border-sky-400/45 bg-sky-400/15 text-sky-100',
  transfer_sent: 'border-violet-400/45 bg-violet-400/15 text-violet-100',
  delivered: 'border-emerald-300/60 bg-emerald-300/25 text-white',
  refunded_kept: 'border-red-400/40 bg-red-400/10 text-red-100',
}

export const SEAT_STATE_LABEL: Record<SeatState, string> = {
  free: 'On sale',
  unpriced: 'No price yet',
  withdrawn: 'Kept back',
  held: 'Held',
  paid: 'Paid',
  transfer_sent: 'Transfer sent',
  delivered: 'Delivered',
  refunded_kept: 'Refunded (seat not returned)',
}

export function eur(cents: number | null | undefined, currency = 'EUR'): string {
  if (cents === null || cents === undefined) return '—'
  const amount = cents / 100
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}

export function shortDateTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "in 5h" / "in 2d" / "lapsed" */
export function timeLeft(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null
  const ms = Date.parse(iso) - now
  if (ms <= 0) return 'lapsed'
  const hours = ms / 3_600_000
  if (hours < 1) return `in ${Math.max(1, Math.round(ms / 60_000))}m`
  if (hours < 48) return `in ${Math.round(hours)}h`
  return `in ${Math.round(hours / 24)}d`
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens umlauts (Nord-Tribüne) correctly.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
