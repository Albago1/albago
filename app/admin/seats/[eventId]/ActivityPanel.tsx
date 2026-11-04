'use client'

import { History } from 'lucide-react'
import type { SeatAdminLogRow } from '@/lib/seats/types'
import { eur, shortDateTime, type ConsoleData } from './consoleShared'

/**
 * Activity log (phase 46): every admin change to stock, prices, rules and
 * orders, newest first (seat_admin_log, append-only, admins only).
 */

const SEAT_STATUS: Record<string, string> = {
  available: 'on sale',
  kept: 'kept back',
  external: 'sold elsewhere',
}

const RESERVATION_ACTION: Record<string, string> = {
  mark_paid: 'marked paid',
  extend_hold: 'hold extended',
  transfer_sent: 'transfer sent',
  undo_transfer: 'transfer undone',
  delivered: 'marked delivered',
  cancel: 'cancelled',
  refund: 'refunded',
  release_seats: 'seats released',
  note: 'note saved',
}

const SETTING_LABEL: Record<string, string> = {
  mode: 'Sale mode',
  deliver_by: 'Delivery date',
  hold_minutes: 'Hold time',
  max_per_order: 'Max seats per buyer',
  seller_name: 'Seller name',
  public_note: 'Public note',
  show_face_value: 'Show face value',
  protect_singles: 'Single-seat protection',
  flexible_from: 'Relaxed from',
  final_from: 'Any quantity from',
  quantity_overrides: 'Group limits',
}

const PAYMENT_FIELD: Record<string, string> = {
  bank_holder: 'account holder',
  iban: 'IBAN',
  bic: 'BIC',
  paypal_me: 'PayPal',
  whatsapp: 'WhatsApp',
  whatsapp_public: 'WhatsApp button',
}

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

function settingValue(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'on' : 'off'
  if (key === 'hold_minutes' && typeof v === 'number') return `${Math.round(v / 60)}h`
  if (key === 'quantity_overrides' && Array.isArray(v)) return `${v.length} group${v.length === 1 ? '' : 's'}`
  if (key === 'public_note' || key === 'seller_name') return 'changed'
  return str(v) || 'changed'
}

/** One plain sentence per log entry. */
export function describe(entry: SeatAdminLogRow): string {
  const d = entry.detail ?? {}
  switch (entry.action) {
    case 'seat_status': {
      const note = str(d.note)
      return `${str(d.seat)}: ${SEAT_STATUS[str(d.from)] ?? str(d.from)} → ${SEAT_STATUS[str(d.to)] ?? str(d.to)}${note ? ` (${note})` : ''}`
    }
    case 'settings': {
      const changes = (d.changes ?? {}) as Record<string, { from: unknown; to: unknown }>
      return Object.entries(changes)
        .map(([key, c]) =>
          key === 'public_note' || key === 'seller_name' || key === 'quantity_overrides'
            ? `${SETTING_LABEL[key] ?? key} changed${key === 'quantity_overrides' ? ` (${settingValue(key, c.to)})` : ''}`
            : `${SETTING_LABEL[key] ?? key}: ${settingValue(key, c.from)} → ${settingValue(key, c.to)}`,
        )
        .join(' · ')
    }
    case 'import':
      return `Added ${str(d.added)} seats`
    case 'category': {
      const parts: string[] = []
      if ('price_cents' in d) parts.push(`price ${typeof d.price_cents === 'number' ? eur(d.price_cents) : 'removed (hidden)'}`)
      if ('face_value_cents' in d) parts.push(`face value ${typeof d.face_value_cents === 'number' ? eur(d.face_value_cents) : '—'}`)
      if ('label' in d) parts.push(`label “${str(d.label)}”`)
      return `Category ${str(d.code)}: ${parts.join(', ') || 'saved'}`
    }
    case 'delete_seat':
      return `Deleted ${str(d.seat)}`
    case 'reservation':
      return `Order ${str(d.reference)}: ${RESERVATION_ACTION[str(d.action)] ?? str(d.action)}${d.released ? ', seats back on sale' : ''}`
    case 'manual_sale':
      return `Manual sale ${str(d.reference)}: ${str(d.quantity)} × ${str(d.category)}${d.paid ? ' (paid)' : ''}`
    case 'payment': {
      const fields = Array.isArray(d.fields) ? (d.fields as unknown[]).map((f) => PAYMENT_FIELD[str(f)] ?? str(f)) : []
      return `Payment details changed${fields.length ? ` (${fields.join(', ')})` : ''}`
    }
    default:
      return entry.action
  }
}

export default function ActivityPanel({ data }: { data: ConsoleData }) {
  const who = (actor: string | null) =>
    actor && actor === data.viewerId ? 'You' : (actor && data.actors[actor]) || 'Admin'

  if (data.log.length === 0) {
    return (
      <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">
        No changes logged yet. Seat status, prices, rules and order steps show up here.
      </p>
    )
  }

  return (
    <section className="max-w-3xl">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
        <History className="h-3.5 w-3.5" /> Activity
      </h2>
      <p className="mt-1.5 text-xs text-white/45">Every change to seats, prices, rules and orders — latest {data.log.length}.</p>
      <ol className="mt-3 divide-y divide-white/[0.05] rounded-2xl border border-white/[0.07] bg-white/[0.02]">
        {data.log.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-0.5 px-3.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="flex-shrink-0 text-[11px] tabular-nums text-white/40 sm:w-28">{shortDateTime(entry.created_at)}</span>
            <span className="min-w-0 flex-1 text-[13px] text-white/80">{describe(entry)}</span>
            <span className="flex-shrink-0 text-[11px] text-white/40">{who(entry.actor)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
