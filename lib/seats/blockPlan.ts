import type { PublicSeat } from './types'
import type { PlanSize } from './venueMaps'

// Seat plan of one block (phase 43): every row of the block with every seat,
// ring at the top, front row first, seat 1 on the left — the close-up a
// buyer gets after tapping a block on the stadium map. AlbaGo only knows its
// own seats, so the block is drawn at a typical size for its tier (or larger,
// to fit the real row and seat numbers); our seats sit at their exact row and
// seat number, every other seat is drawn as not available.

export type PlanSeat = {
  n: number
  x: number
  y: number
  /** AlbaGo's seat at this position, or null for a seat not on sale here. */
  seat: PublicSeat | null
}

export type PlanRow = {
  label: string
  y: number
  /** x of the row label on each side. */
  labelLeft: number
  labelRight: number
  seats: PlanSeat[]
}

export type Box = { x: number; y: number; w: number; h: number }

export type SeatPlan = {
  rows: PlanRow[]
  width: number
  height: number
  /** Ring band across the top. */
  stage: Box
  /** Outline around the seats: front edge narrower when the rows fan out. */
  outline: string
  /** Box around AlbaGo's seats — where the plan opens. */
  focus: Box | null
  /** Seat radius in plan units (seat pitch at the front row is 1). */
  radius: number
}

const ROW_GAP = 1.32
const LABEL = 1.9
const STAGE_H = 1.7
const TOP = STAGE_H + 1.5
const RADIUS = 0.4

const r3 = (n: number) => Math.round(n * 1000) / 1000
const naturalCmp = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })
const asNumber = (row: string) => (/^\d+$/.test(row.trim()) ? Number(row.trim()) : NaN)

export function buildSeatPlan(seats: PublicSeat[], size: PlanSize & { fan: number }): SeatPlan {
  // Rows 1…N when the row labels are numbers (they are on Eventim plans);
  // otherwise just the rows we know, in natural order.
  const numeric = seats.length > 0 && seats.every((s) => !Number.isNaN(asNumber(s.row)))
  const rowKey = (row: string) => (numeric ? String(asNumber(row)) : row.trim())
  const labels = numeric
    ? Array.from(
        { length: Math.max(size.rows, Math.max(...seats.map((s) => asNumber(s.row))) + 2) },
        (_, i) => String(i + 1),
      )
    : [...new Set(seats.map((s) => rowKey(s.row)))].sort(naturalCmp)
  const perRow = Math.max(size.seatsPerRow, Math.max(0, ...seats.map((s) => s.seat)) + 2)

  const byPosition = new Map(seats.map((s) => [`${rowKey(s.row)}|${s.seat}`, s]))
  const pitch = (i: number) => 1 + size.fan * i
  const backPitch = pitch(Math.max(0, labels.length - 1))
  const width = perRow * backPitch + 2 * LABEL
  const cx = width / 2

  const rows: PlanRow[] = labels.map((label, i) => {
    const y = r3(TOP + i * ROW_GAP + 0.5)
    const p = pitch(i)
    const half = (perRow * p) / 2
    return {
      label,
      y,
      labelLeft: r3(cx - half - LABEL / 2),
      labelRight: r3(cx + half + LABEL / 2),
      seats: Array.from({ length: perRow }, (_, k) => ({
        n: k + 1,
        x: r3(cx + (k + 1 - (perRow + 1) / 2) * p),
        y,
        seat: byPosition.get(`${label}|${k + 1}`) ?? null,
      })),
    }
  })

  const height = r3(TOP + labels.length * ROW_GAP + 0.6)
  const frontHalf = (perRow * pitch(0)) / 2 + 0.25
  const backHalf = (perRow * backPitch) / 2 + 0.25
  const top = TOP - 0.3
  const bottom = height - 0.35
  const outline = `M${r3(cx - frontHalf)} ${r3(top)} L${r3(cx + frontHalf)} ${r3(top)} L${r3(cx + backHalf)} ${r3(bottom)} L${r3(cx - backHalf)} ${r3(bottom)} Z`

  const ours = rows.flatMap((r) => r.seats.filter((s) => s.seat))
  const focus = ours.length
    ? (() => {
        const xs = ours.map((s) => s.x)
        const ys = ours.map((s) => s.y)
        const x0 = Math.min(...xs) - 2.5
        const x1 = Math.max(...xs) + 2.5
        const y0 = Math.min(...ys) - 2.2
        const y1 = Math.max(...ys) + 2.2
        return { x: r3(x0), y: r3(y0), w: r3(x1 - x0), h: r3(y1 - y0) }
      })()
    : null

  return {
    rows,
    width: r3(width),
    height,
    stage: { x: r3(cx - frontHalf), y: 0.4, w: r3(frontHalf * 2), h: STAGE_H },
    outline,
    focus,
    radius: RADIUS,
  }
}
