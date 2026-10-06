import { NextResponse } from 'next/server'
import { isRequestAdmin } from '@/lib/admin/apiAuth'
import { createClient } from '@/lib/supabase/server'
import { cleanText, seatRpcError, UUID_RE } from '@/lib/seats/errors'
import { parseEventimSeats, suggestCategories } from '@/lib/seats/parseEventimSeats'
import { sendSeatEmail } from '@/lib/seats/sendSeatEmail'
import type { SeatEmailKind } from '@/lib/email/templates/seatReservation'
import {
  ADMIN_RESERVATION_ACTIONS,
  PAYMENT_METHODS,
  SEAT_SALE_MODES,
  type AdminReservationAction,
  type PaymentMethod,
  type ReservationResult,
  type SeatReservationRow,
  type SeatSaleMode,
} from '@/lib/seats/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 20

/**
 * Seat console API (phase 43). Admin session on every verb; table writes go
 * through the admin RLS policies, reservation moves through the
 * seat_admin_update state machine.
 *   PATCH { mode?, deliverBy?, holdMinutes?, maxPerOrder?, sellerName?, publicNote?, showFaceValue? }
 *   POST  { op: 'import', text }
 *         { op: 'category', code, label?, faceValueCents?, priceCents?, sortOrder? }
 *         { op: 'seat', seatId, withdrawn }            (free seats only)
 *         { op: 'delete_seat', seatId }                 (never-sold seats only)
 *         { op: 'reservation', reservationId, action, paymentMethod?, paymentRef?, adminNote?, release?, notify? }
 *         { op: 'manual_sale', category, quantity, buyerName, buyerEmail, eventimEmail?, phone?, note?, paid, paymentMethod?, notify? }
 *         { op: 'delete_waitlist', id }
 */

type Params = { params: Promise<{ eventId: string }> }

const forbidden = () => NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
const bad = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 })

// Emails the buyer gets for each admin move (others are silent).
const ACTION_EMAIL: Partial<Record<AdminReservationAction, SeatEmailKind>> = {
  mark_paid: 'paid',
  transfer_sent: 'transfer_sent',
  cancel: 'cancelled',
  refund: 'refunded',
}

function rpcFailure(message: string, where: string) {
  const known = seatRpcError(message)
  if (known) return NextResponse.json({ ok: false, error: known.code }, { status: known.status })
  console.error(`[admin/seats] ${where} failed:`, message)
  return NextResponse.json({ ok: false, error: `${where}_failed` }, { status: 500 })
}

function intOrNull(value: unknown, min: number, max: number): number | null | undefined {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return undefined
  return value
}

export async function PATCH(request: Request, { params }: Params) {
  if (!(await isRequestAdmin())) return forbidden()
  const { eventId } = await params
  if (!UUID_RE.test(eventId)) return bad('bad_event')

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return bad('bad_json')
  }

  const patch: Record<string, unknown> = {}
  if (body.mode !== undefined) {
    if (!SEAT_SALE_MODES.includes(body.mode as SeatSaleMode)) return bad('bad_mode')
    patch.mode = body.mode
  }
  if (body.deliverBy !== undefined) {
    if (body.deliverBy === null || body.deliverBy === '') patch.deliver_by = null
    else if (typeof body.deliverBy === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.deliverBy)) {
      patch.deliver_by = body.deliverBy
    } else return bad('bad_deliver_by')
  }
  if (body.holdMinutes !== undefined) {
    const v = intOrNull(body.holdMinutes, 30, 20160)
    if (v === undefined || v === null) return bad('bad_hold')
    patch.hold_minutes = v
  }
  if (body.maxPerOrder !== undefined) {
    const v = intOrNull(body.maxPerOrder, 1, 20)
    if (v === undefined || v === null) return bad('bad_max')
    patch.max_per_order = v
  }
  if (body.sellerName !== undefined) patch.seller_name = cleanText(body.sellerName, 120)
  if (body.publicNote !== undefined) patch.public_note = cleanText(body.publicNote, 600)
  if (body.showFaceValue !== undefined) patch.show_face_value = body.showFaceValue === true
  if (Object.keys(patch).length === 0) return bad('nothing_to_update')

  const supabase = await createClient()
  const { error } = await supabase.from('seat_sales').update(patch).eq('event_id', eventId)
  if (error) return rpcFailure(error.message, 'settings')
  return NextResponse.json({ ok: true })
}

export async function POST(request: Request, { params }: Params) {
  if (!(await isRequestAdmin())) return forbidden()
  const { eventId } = await params
  if (!UUID_RE.test(eventId)) return bad('bad_event')

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return bad('bad_json')
  }

  const supabase = await createClient()

  switch (body.op) {
    case 'import': {
      if (typeof body.text !== 'string' || body.text.length > 200_000) return bad('bad_text')
      const parsed = parseEventimSeats(body.text)
      if (parsed.seats.length === 0) {
        return NextResponse.json({ ok: true, added: 0, duplicates: parsed.duplicates, problems: parsed.problems })
      }
      // New categories start unpriced (hidden publicly) until the admin sets a price.
      const categories = suggestCategories(parsed.seats).map((c) => ({
        event_id: eventId,
        code: c.code,
        label: c.label.slice(0, 80),
        sort_order: Number(c.code.replace(/\D/g, '')) || 0,
      }))
      const { error: catError } = await supabase
        .from('seat_categories')
        .upsert(categories, { onConflict: 'event_id,code', ignoreDuplicates: true })
      if (catError) return rpcFailure(catError.message, 'import_categories')

      const { data: inserted, error: seatError } = await supabase
        .from('seat_stock')
        .upsert(
          parsed.seats.map((s) => ({
            event_id: eventId,
            category: s.category,
            area: s.area.slice(0, 80),
            block: s.block.slice(0, 20),
            row_label: s.row.slice(0, 20),
            seat_number: s.seat,
          })),
          { onConflict: 'event_id,area,block,row_label,seat_number', ignoreDuplicates: true },
        )
        .select('id')
      if (seatError) return rpcFailure(seatError.message, 'import_seats')
      const added = inserted?.length ?? 0
      return NextResponse.json({
        ok: true,
        added,
        duplicates: parsed.duplicates + (parsed.seats.length - added),
        problems: parsed.problems,
      })
    }

    case 'category': {
      const code = cleanText(body.code, 40)
      if (!code) return bad('bad_code')
      const patch: Record<string, unknown> = {}
      if (body.label !== undefined) {
        const label = cleanText(body.label, 80)
        if (!label) return bad('bad_label')
        patch.label = label
      }
      if (body.faceValueCents !== undefined) {
        const v = intOrNull(body.faceValueCents, 0, 10_000_000)
        if (v === undefined) return bad('bad_face_value')
        patch.face_value_cents = v
      }
      if (body.priceCents !== undefined) {
        const v = intOrNull(body.priceCents, 0, 10_000_000)
        if (v === undefined) return bad('bad_price')
        patch.price_cents = v
      }
      if (body.sortOrder !== undefined) {
        const v = intOrNull(body.sortOrder, -1000, 1000)
        if (v === undefined || v === null) return bad('bad_sort')
        patch.sort_order = v
      }
      if (Object.keys(patch).length === 0) return bad('nothing_to_update')
      const { error } = await supabase
        .from('seat_categories')
        .update(patch)
        .eq('event_id', eventId)
        .eq('code', code)
      if (error) return rpcFailure(error.message, 'category')
      return NextResponse.json({ ok: true })
    }

    case 'seat': {
      const seatId = typeof body.seatId === 'string' ? body.seatId : ''
      if (!UUID_RE.test(seatId) || typeof body.withdrawn !== 'boolean') return bad('bad_seat')
      // Only a seat nobody holds can be kept back or returned to sale.
      const { data, error } = await supabase
        .from('seat_stock')
        .update({ withdrawn: body.withdrawn })
        .eq('id', seatId)
        .eq('event_id', eventId)
        .is('reservation_id', null)
        .select('id')
      if (error) return rpcFailure(error.message, 'seat')
      if (!data?.length) return NextResponse.json({ ok: false, error: 'seat_taken' }, { status: 409 })
      return NextResponse.json({ ok: true })
    }

    case 'delete_seat': {
      const seatId = typeof body.seatId === 'string' ? body.seatId : ''
      if (!UUID_RE.test(seatId)) return bad('bad_seat')
      const { data, error } = await supabase
        .from('seat_stock')
        .delete()
        .eq('id', seatId)
        .eq('event_id', eventId)
        .is('reservation_id', null)
        .select('id')
      if (error) return rpcFailure(error.message, 'delete_seat')
      if (!data?.length) return NextResponse.json({ ok: false, error: 'seat_taken' }, { status: 409 })
      return NextResponse.json({ ok: true })
    }

    case 'reservation': {
      const reservationId = typeof body.reservationId === 'string' ? body.reservationId : ''
      const action = body.action as AdminReservationAction
      if (!UUID_RE.test(reservationId) || !ADMIN_RESERVATION_ACTIONS.includes(action)) {
        return bad('bad_reservation_action')
      }
      const paymentMethod =
        body.paymentMethod === undefined || body.paymentMethod === null
          ? null
          : PAYMENT_METHODS.includes(body.paymentMethod as PaymentMethod)
            ? (body.paymentMethod as PaymentMethod)
            : undefined
      if (paymentMethod === undefined) return bad('bad_payment_method')

      const { data, error } = await supabase.rpc('seat_admin_update', {
        p_reservation_id: reservationId,
        p_action: action,
        p_payment_method: paymentMethod,
        p_payment_ref: cleanText(body.paymentRef, 120),
        p_admin_note: typeof body.adminNote === 'string' ? body.adminNote.slice(0, 1000) : null,
        p_release: body.release === true,
      })
      if (error) return rpcFailure(error.message, 'reservation')

      const row = data as SeatReservationRow
      const kind = ACTION_EMAIL[action]
      let emailed = false
      if (kind && body.notify !== false && row.event_id === eventId) {
        emailed = await sendSeatEmail(supabase, kind, eventId, row)
      }
      return NextResponse.json({ ok: true, reservation: row, emailed })
    }

    case 'manual_sale': {
      const category = cleanText(body.category, 40)
      const quantity = typeof body.quantity === 'number' ? body.quantity : NaN
      if (!category || !Number.isInteger(quantity)) return bad('bad_manual_sale')
      const paymentMethod =
        body.paymentMethod && PAYMENT_METHODS.includes(body.paymentMethod as PaymentMethod)
          ? (body.paymentMethod as PaymentMethod)
          : null
      const paid = body.paid === true

      const { data, error } = await supabase.rpc('seat_admin_manual_sale', {
        p_event_id: eventId,
        p_category: category,
        p_quantity: quantity,
        p_buyer_name: cleanText(body.buyerName, 120),
        p_buyer_email: cleanText(body.buyerEmail, 254),
        p_eventim_email: cleanText(body.eventimEmail, 254),
        p_phone: cleanText(body.phone, 40),
        p_note: cleanText(body.note, 500),
        p_paid: paid,
        p_payment_method: paymentMethod,
      })
      if (error) return rpcFailure(error.message, 'manual_sale')

      const result = data as ReservationResult
      let emailed = false
      if (body.notify !== false) {
        const { data: row } = await supabase
          .from('seat_reservations')
          .select('*')
          .eq('id', result.id)
          .maybeSingle()
        if (row) {
          emailed = await sendSeatEmail(supabase, paid ? 'paid' : 'reserved', eventId, row as SeatReservationRow)
        }
      }
      return NextResponse.json({ ok: true, reservation: result, emailed })
    }

    case 'delete_waitlist': {
      const id = typeof body.id === 'string' ? body.id : ''
      if (!UUID_RE.test(id)) return bad('bad_id')
      const { error } = await supabase.from('seat_waitlist').delete().eq('id', id).eq('event_id', eventId)
      if (error) return rpcFailure(error.message, 'delete_waitlist')
      return NextResponse.json({ ok: true })
    }

    default:
      return bad('bad_op')
  }
}
