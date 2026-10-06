import type { FreeRun } from './types'

// On-screen preview of which seats a group would get — the same rules as the
// seat_pick RPC (docs/seeds/phase-43-seat-sales.sql, keep in sync):
//   1st: a run that fits exactly · 2nd: the smallest run leaving ≥2 seats ·
//   last resort: a run leaving exactly 1 seat; seats taken from the low end.
// The RPC stays the authority; this only drives the stadium-map highlight.

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
): SeatPick | null {
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

export function freeInBlock(runs: FreeRun[], block: BlockRef): number {
  return runs
    .filter((r) => r.area === block.area && r.block === block.block)
    .reduce((n, r) => n + r.len, 0)
}
