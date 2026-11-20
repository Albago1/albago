import type { SeatRef, SeatReservationRow } from './types'

/**
 * Tickets on request (phase 47): stock sold by count per block, with the
 * exact seats assigned by the seller later. The SQL functions
 * (seat_reserve_allocation, seat_admin_assign_seats) are the authority;
 * these helpers validate console input and mirror the counts for display.
 */

const TAKEN = new Set(['paid', 'transfer_sent', 'delivered'])

/** Mirror of seat_allocation_taken(): live holds plus every order past payment. */
export function allocationTaken(
  allocationId: string,
  reservations: Array<Pick<SeatReservationRow, 'allocation_id' | 'status' | 'quantity' | 'expires_at'>>,
  now = Date.now(),
): { sold: number; held: number } {
  let sold = 0
  let held = 0
  for (const r of reservations) {
    if (r.allocation_id !== allocationId) continue
    if (TAKEN.has(r.status)) sold += r.quantity
    else if (r.status === 'held' && !(r.expires_at && Date.parse(r.expires_at) <= now)) held += r.quantity
  }
  return { sold, held }
}

export type AllocationInput = {
  label: string
  area: string
  blocks: string[]
  rows_label: string | null
  quantity: number
  price_cents: number
  note: string | null
  active: boolean
  sort_order: number
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ')
  return t && t.length <= max ? t : null
}

/** Not given: absent, null or only spaces. */
const blank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && !v.trim())

const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null

/** Blocks from the console: an array or "14, 17" — unique, at most 10. */
export function parseBlocks(value: unknown): string[] | null {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,/;]+/) : null
  if (!raw) return null
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') return null
    const b = item.trim()
    if (!b) continue
    if (b.length > 20) return null
    if (!out.includes(b)) out.push(b)
  }
  return out.length <= 10 ? out : null
}

/** A whole allocation from the console form, or the name of the bad field. */
export function parseAllocationInput(body: Record<string, unknown>): AllocationInput | { error: string } {
  const label = text(body.label, 80)
  if (!label) return { error: 'bad_label' }
  const area = text(body.area, 80)
  if (!area) return { error: 'bad_area' }
  const blocks = parseBlocks(body.blocks)
  if (!blocks) return { error: 'bad_blocks' }
  let rows: string | null = null
  if (!blank(body.rows)) {
    rows = text(body.rows, 40)
    if (!rows) return { error: 'bad_rows' }
  }
  const quantity = int(body.quantity, 0, 10_000)
  if (quantity === null) return { error: 'bad_quantity' }
  const price = int(body.priceCents, 0, 10_000_000)
  if (price === null) return { error: 'bad_price' }
  let note: string | null = null
  if (!blank(body.note)) {
    note = text(body.note, 200)
    if (!note) return { error: 'bad_note' }
  }
  const sort = body.sortOrder === undefined ? 0 : int(body.sortOrder, -1000, 1000)
  if (sort === null) return { error: 'bad_sort' }
  return {
    label,
    area,
    blocks,
    rows_label: rows,
    quantity,
    price_cents: price,
    note,
    active: body.active !== false,
    sort_order: sort,
  }
}

/** The seats an admin assigns to a seats-on-request order: exactly `quantity`, no repeats. */
export function parseAssignedSeats(value: unknown, quantity: number): SeatRef[] | null {
  if (!Array.isArray(value) || value.length !== quantity || quantity < 1 || quantity > 20) return null
  const out: SeatRef[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const o = item as Record<string, unknown>
    const area = text(o.area, 80)
    const block = text(o.block, 20)
    const row = text(o.row, 20)
    const seat = int(o.seat, 1, 10_000)
    if (!area || !block || !row || seat === null) return null
    const key = JSON.stringify([area, block, row, seat])
    if (seen.has(key)) return null
    seen.add(key)
    out.push({ area, block, row, seat })
  }
  return out
}

/** `count` side-by-side seats starting at `first` — the console's quick fill. */
export function consecutiveSeats(area: string, block: string, row: string, first: number, count: number): SeatRef[] {
  return Array.from({ length: count }, (_, i) => ({ area, block, row, seat: first + i }))
}
