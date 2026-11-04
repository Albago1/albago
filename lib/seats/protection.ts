import type { FreeRun } from './types'

/**
 * Single-seat protection (phase 46): sell seats so nobody leaves one lonely
 * seat behind that can't be sold any more. The database enforces the same
 * rules (seat_run_allows / seat_selection_problem in
 * supabase/migrations/*_seat_protection.sql — keep in sync); this module
 * drives the screens: which quantities a group offers, which seats a
 * quantity gets, and why a hand-picked selection is refused.
 *
 * A "group" is a free run: seats side by side in one row, between seats
 * that are sold, held, kept back or sold elsewhere.
 */

/** off = protection switched off; otherwise the selling phase of the day. */
export type SeatPhase = 'off' | 'protected' | 'flexible' | 'final'

/** Admin override: quantities allowed for groups inside seats from..to of a row. */
export type QuantityOverride = {
  area: string
  block: string
  row: string
  from: number
  to: number
  quantities: number[]
}

/** As seat_sale_public returns it (phase computed by the database, Berlin date). */
export type SeatRules = {
  protect: boolean
  phase: SeatPhase
  flexible_from: string | null
  final_from: string | null
  overrides: QuantityOverride[]
}

export type RuleContext = {
  phase: SeatPhase
  overrides: QuantityOverride[]
  /** Every free run of the sale (the flexible phase looks for alternatives). */
  runs: FreeRun[]
  maxPerOrder: number
}

export type SelectionProblem = 'not_together' | 'splits_group' | 'strands_seat' | 'quantity_not_allowed'

export type SelectionCheck =
  | { ok: true; run: FreeRun | null }
  | { ok: false; reason: SelectionProblem; run: FreeRun | null; allowed: number[] }

const lastSeat = (run: FreeRun) => run.first + run.len - 1

/** Today's date in Berlin ("2026-11-10"), whatever the device's time zone. */
export function berlinDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** The phase on a Berlin calendar date (mirrors seat_phase in SQL). */
export function phaseOn(rules: Pick<SeatRules, 'protect' | 'flexible_from' | 'final_from'>, date: string): SeatPhase {
  if (!rules.protect) return 'off'
  if (rules.final_from && date >= rules.final_from) return 'final'
  if (rules.flexible_from && date >= rules.flexible_from) return 'flexible'
  return 'protected'
}

export function overrideFor(run: FreeRun, overrides: QuantityOverride[]): QuantityOverride | null {
  return (
    overrides.find(
      (o) => o.area === run.area && o.block === run.block && o.row === run.row && run.first >= o.from && lastSeat(run) <= o.to,
    ) ?? null
  )
}

const strands = (len: number, q: number) => len - q === 1

/** Some other group of the same price could take q seats without stranding one. */
function cleanAlternative(q: number, run: FreeRun, ctx: RuleContext): boolean {
  return ctx.runs.some(
    (r) =>
      r.category === run.category &&
      !(r.area === run.area && r.block === run.block && r.row === run.row && r.first === run.first) &&
      r.len >= q &&
      !strands(r.len, q),
  )
}

/** Whether q seats, taken from one end of the group, may be sold today. */
export function runAllows(run: FreeRun, q: number, ctx: RuleContext): boolean {
  if (q < 1 || q > run.len || q > ctx.maxPerOrder) return false
  if (ctx.phase === 'off' || ctx.phase === 'final') return true
  const o = overrideFor(run, ctx.overrides)
  if (o && !o.quantities.includes(q)) return false
  if (!strands(run.len, q)) return true
  // Leaves exactly one seat: never while protected; while flexible only
  // when no other group of that price could take this order cleanly.
  return ctx.phase === 'flexible' && !cleanAlternative(q, run, ctx)
}

/** The quantities a group offers today, smallest first. */
export function allowedQuantities(run: FreeRun, ctx: RuleContext): number[] {
  const out: number[] = []
  for (let q = 1; q <= Math.min(run.len, ctx.maxPerOrder); q++) if (runAllows(run, q, ctx)) out.push(q)
  return out
}

/** Seats for q from one end of the group (the low end, like seat_pick). */
export function assignSeats(run: FreeRun, q: number): number[] {
  return Array.from({ length: Math.min(q, run.len) }, (_, i) => run.first + i)
}

/**
 * The best group of a price for q seats (mirrors seat_pick): an exact fit,
 * else the smallest group that keeps ≥2 seats, else (when the phase allows
 * it) one that strands a seat — preserving the bigger groups for bigger orders.
 */
export function bestRun(runs: FreeRun[], category: string, q: number, ctx: RuleContext, within?: { area: string; block: string }): FreeRun | null {
  const fit = (len: number) => (len === q ? 0 : len - q >= 2 ? 1 : 2)
  const candidates = runs
    .filter((r) => r.category === category && (!within || (r.area === within.area && r.block === within.block)) && runAllows(r, q, ctx))
    .sort((a, b) => fit(a.len) - fit(b.len) || a.len - b.len || cmp(a.area, b.area) || cmp(a.block, b.block) || cmp(a.row, b.row) || a.first - b.first)
  return candidates[0] ?? null
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

type SeatLike = { category?: string; area: string; block: string; row: string; seat: number }

/**
 * Is a hand-picked selection allowed? Seats must sit side by side in one
 * group; while protection holds they must start at one end of it and leave
 * no lonely seat (mirrors seat_selection_problem).
 */
export function checkSelection(seats: SeatLike[], ctx: RuleContext): SelectionCheck {
  if (seats.length === 0) return { ok: true, run: null }
  const sorted = [...seats].sort((a, b) => a.seat - b.seat)
  const first = sorted[0]
  const sameRow = sorted.every((s) => s.area === first.area && s.block === first.block && s.row === first.row)
  const consecutive = sorted.every((s, i) => i === 0 || s.seat === sorted[i - 1].seat + 1)
  const run =
    ctx.runs.find(
      (r) => r.area === first.area && r.block === first.block && r.row === first.row && first.seat >= r.first && first.seat <= lastSeat(r),
    ) ?? null
  const last = sorted[sorted.length - 1]
  if (!sameRow || !consecutive || !run || last.seat > lastSeat(run)) {
    return { ok: false, reason: 'not_together', run, allowed: run ? allowedQuantities(run, ctx) : [] }
  }
  if (ctx.phase === 'off' || ctx.phase === 'final') return { ok: true, run }
  const q = sorted.length
  const allowed = allowedQuantities(run, ctx)
  if (first.seat > run.first && last.seat < lastSeat(run)) return { ok: false, reason: 'splits_group', run, allowed }
  if (!runAllows(run, q, ctx)) {
    return { ok: false, reason: strands(run.len, q) ? 'strands_seat' : 'quantity_not_allowed', run, allowed }
  }
  return { ok: true, run }
}

export function ruleContext(rules: SeatRules | null | undefined, runs: FreeRun[], maxPerOrder: number): RuleContext {
  return {
    phase: rules?.phase ?? 'off',
    overrides: rules?.overrides ?? [],
    runs,
    maxPerOrder,
  }
}
