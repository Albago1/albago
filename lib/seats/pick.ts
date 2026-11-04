import { bestRun, type RuleContext } from './protection'
import type { FreeRun } from './types'

// On-screen preview of which seats a group would get — the same rules as the
// seat_pick RPC (keep in sync):
//   1st: a run that fits exactly · 2nd: the smallest run leaving ≥2 seats ·
//   last resort: a run leaving exactly 1 seat; seats taken from the low end.
// With a RuleContext, runs the day's single-seat protection doesn't allow
// are skipped (phase 46). The RPC stays the authority.

export type BlockRef = { area: string; block: string }

export type SeatPick = {
  area: string
  block: string
  row: string
  /** The whole free run the seats come from (for the row strip). */
  runFirst: number
  runLen: number
  seats: number[]
}

export const blockKey = (b: BlockRef): string => `${b.area}|${b.block}`

// Plain code-unit comparison, matching Postgres "C"-style text ordering for
// the tie-breaks that matter here (numeric block and row labels).
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function fitClass(len: number, quantity: number): number {
  if (len === quantity) return 0
  if (len - quantity >= 2) return 1
  return 2
}

export function pickSeats(
  runs: FreeRun[],
  category: string,
  quantity: number,
  block?: BlockRef | null,
  rules?: RuleContext,
): SeatPick | null {
  if (rules) {
    const run = quantity >= 1 ? bestRun(runs, category, quantity, rules, block ?? undefined) : null
    return run
      ? {
          area: run.area,
          block: run.block,
          row: run.row,
          runFirst: run.first,
          runLen: run.len,
          seats: Array.from({ length: quantity }, (_, i) => run.first + i),
        }
      : null
  }
  const candidates = runs.filter(
    (r) =>
      r.category === category &&
      r.len >= quantity &&
      (!block || (r.area === block.area && r.block === block.block)),
  )
  if (candidates.length === 0 || quantity < 1) return null
  candidates.sort(
    (a, b) =>
      fitClass(a.len, quantity) - fitClass(b.len, quantity) ||
      a.len - b.len ||
      cmp(a.area, b.area) ||
      cmp(a.block, b.block) ||
      cmp(a.row, b.row) ||
      a.first - b.first,
  )
  const run = candidates[0]
  return {
    area: run.area,
    block: run.block,
    row: run.row,
    runFirst: run.first,
    runLen: run.len,
    seats: Array.from({ length: quantity }, (_, i) => run.first + i),
  }
}

/** Biggest group that can sit together inside one block. */
export function maxTogetherInBlock(runs: FreeRun[], block: BlockRef): number {
  return runs
    .filter((r) => r.area === block.area && r.block === block.block)
    .reduce((max, r) => Math.max(max, r.len), 0)
}

// ---- exact seats (block close-up) -------------------------------------------

export type SeatRefKey = { area: string; block: string; row: string; seat: number }

export const seatKeyOf = (s: SeatRefKey): string => `${s.area}|${s.block}|${s.row}|${s.seat}`

export function parseSeatKey(key: string): SeatRefKey {
  const parts = key.split('|')
  const seat = Number(parts.pop())
  const row = parts.pop() ?? ''
  const block = parts.pop() ?? ''
  return { area: parts.join('|'), block, row, seat }
}

const naturalCmp = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })

export type SeatRow<T extends { seat: number }> = {
  row: string
  /** Seats in order; `gapBefore` marks a jump in numbering (other people's seats). */
  seats: Array<T & { gapBefore: boolean }>
}

/** Rows of one block, front row first, seats left to right. */
export function rowsOf<T extends { row: string; seat: number }>(seats: T[]): SeatRow<T>[] {
  const byRow = new Map<string, T[]>()
  for (const s of seats) byRow.set(s.row, [...(byRow.get(s.row) ?? []), s])
  return [...byRow.entries()]
    .sort(([a], [b]) => naturalCmp(a, b))
    .map(([row, list]) => {
      const sorted = [...list].sort((a, b) => a.seat - b.seat)
      return {
        row,
        seats: sorted.map((s, i) => ({ ...s, gapBefore: i > 0 && s.seat !== sorted[i - 1].seat + 1 })),
      }
    })
}

/** The best seats for `quantity` inside one block, as seat keys — what the
 *  close-up pre-selects. Falls back to the biggest group that still fits
 *  (and that the day's rules allow). */
export function bestKeysInBlock(
  runs: FreeRun[],
  category: string,
  quantity: number,
  block: BlockRef,
  rules?: RuleContext,
): string[] {
  for (let fit = Math.min(quantity, maxTogetherInBlock(runs, block)); fit >= 1; fit--) {
    const pick = pickSeats(runs, category, fit, block, rules)
    if (pick) return pick.seats.map((seat) => seatKeyOf({ area: pick.area, block: pick.block, row: pick.row, seat }))
    if (!rules) return []
  }
  return []
}

export function freeInBlock(runs: FreeRun[], block: BlockRef): number {
  return runs
    .filter((r) => r.area === block.area && r.block === block.block)
    .reduce((n, r) => n + r.len, 0)
}
