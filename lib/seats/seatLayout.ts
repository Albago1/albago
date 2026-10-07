import type { PublicSeat } from './types'
import { isCorner, pointOn, type MapBlock, type VenueMap } from './venueMaps'

// Seats drawn in place on the stadium map (phase 43): every block of the
// venue filled with rows of seats, so zooming into the map shows the seats
// right where they are — no separate seat screen. AlbaGo only knows its own
// seats, so a block is drawn with a typical number of rows and seats for its
// tier (more if the real row / seat numbers need it). AlbaGo's seats sit at
// their exact row and seat number; every other seat is a grey dot.
//
// Bowl blocks: rows run along the field edge, row 1 nearest the field, seat
// 1 at the clockwise start of the block. Corner rows get longer toward the
// back, with more seats. Floor blocks: rows face the ring, row 1 nearest it.

export type LaidSeat = {
  n: number
  row: string
  x: number
  y: number
  /** AlbaGo's seat here, or null for a seat not sold on AlbaGo. */
  seat: PublicSeat | null
}

export type BlockLayout = {
  seats: LaidSeat[]
  radius: number
  /** Row numbers at both ends of every row. */
  rowLabels: Array<{ label: string; x: number; y: number }>
  labelSize: number
  /** Centre of AlbaGo's seats (the block centre when it has none). */
  focus: { x: number; y: number }
  /** Every seat that isn't AlbaGo's, as one SVG path. */
  others: string
}

const ROW_PAD = 0.8 // gap at the front and back of a tier band
const SIDE_PAD = 0.7 // aisle at each end of a row
const FLOOR_PAD = 0.5

const r3 = (n: number) => Math.round(n * 1000) / 1000
const naturalCmp = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })
const asNumber = (row: string) => (/^\d+$/.test(row.trim()) ? Number(row.trim()) : NaN)

/** Row labels of a block: 1…N when rows are numbered, else the known rows. */
function rowsFor(seats: PublicSeat[], minRows: number): { labels: string[]; keyOf: (row: string) => string } {
  const numeric = seats.every((s) => !Number.isNaN(asNumber(s.row)))
  if (numeric) {
    const maxRow = Math.max(0, ...seats.map((s) => asNumber(s.row)))
    const n = Math.max(minRows, maxRow + (seats.length ? 2 : 0))
    return { labels: Array.from({ length: n }, (_, i) => String(i + 1)), keyOf: (row) => String(asNumber(row)) }
  }
  return { labels: [...new Set(seats.map((s) => s.row.trim()))].sort(naturalCmp), keyOf: (row) => row.trim() }
}

const circle = (x: number, y: number, r: number) =>
  `M${r3(x - r)} ${r3(y)}a${r3(r)} ${r3(r)} 0 1 0 ${r3(2 * r)} 0a${r3(r)} ${r3(r)} 0 1 0 ${r3(-2 * r)} 0`

export function layoutBlock(map: VenueMap, block: MapBlock, seats: PublicSeat[]): BlockLayout {
  const out: LaidSeat[] = []
  const rowLabels: BlockLayout['rowLabels'] = []
  let radius = 0.3
  let labelSize = 0.5

  if (block.slice && block.tier >= 0) {
    const { side, f0, f1, inner, outer } = block.slice
    const tier = map.tiers[block.tier]
    const field = map.field
    const vertical = side === 'L' || side === 'R'
    const sideLen = vertical ? field.y1 - field.y0 : field.x1 - field.x0
    // Seat pitch of a typical straight block in this tier.
    const straightLen = (field.y1 - field.y0) / Math.max(1, tier.sides.L.length)
    const pitch = (straightLen - 2 * SIDE_PAD) / tier.plan.seatsPerRow
    const corner = isCorner(side)
    const lenAt = (d: number) => (corner ? d * (Math.PI / 2) * (f1 - f0) : (f1 - f0) * sideLen)

    const { labels, keyOf } = rowsFor(seats, tier.plan.rows)
    const rowPitch = (outer - inner - 2 * ROW_PAD) / labels.length
    const maxSeat = Math.max(0, ...seats.map((s) => s.seat))
    const byPos = new Map(seats.map((s) => [`${keyOf(s.row)}|${s.seat}`, s]))
    radius = 0.36 * Math.min(rowPitch, pitch)
    labelSize = Math.min(rowPitch * 0.55, 0.62)

    labels.forEach((label, i) => {
      const d = inner + ROW_PAD + (i + 0.5) * rowPitch
      const len = lenAt(d)
      const usable = Math.max(0, len - 2 * SIDE_PAD)
      const maxHere = Math.max(0, ...seats.filter((s) => keyOf(s.row) === label).map((s) => s.seat))
      const count = corner
        ? Math.max(1, maxHere + (maxHere ? 1 : 0), Math.round(usable / pitch))
        : Math.max(tier.plan.seatsPerRow, maxSeat + 2)
      const padF = len > 0 ? ((f1 - f0) * Math.min(SIDE_PAD, len / 4)) / len : 0
      const fa = f0 + padF
      const fb = f1 - padF
      for (let s = 1; s <= count; s++) {
        const [x, y] = pointOn(field, side, fa + ((s - 0.5) / count) * (fb - fa), d)
        out.push({ n: s, row: label, x: r3(x), y: r3(y), seat: byPos.get(`${label}|${s}`) ?? null })
      }
      const [lx0, ly0] = pointOn(field, side, f0 + padF * 0.45, d)
      const [lx1, ly1] = pointOn(field, side, f1 - padF * 0.45, d)
      rowLabels.push({ label, x: r3(lx0), y: r3(ly0) }, { label, x: r3(lx1), y: r3(ly1) })
    })
  } else if (block.rect) {
    const rect = block.rect
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    const dx = (map.ring.cx - cx) / rect.w
    const dy = (map.ring.cy - cy) / rect.h
    const horizontal = Math.abs(dy) >= Math.abs(dx)
    const along = horizontal ? rect.w : rect.h
    const across = horizontal ? rect.h : rect.w
    const { labels, keyOf } = rowsFor(seats, Math.max(2, Math.round((across - 2 * FLOOR_PAD) / 1.05)))
    const maxSeat = Math.max(0, ...seats.map((s) => s.seat))
    const count = Math.max(maxSeat + 2, Math.round((along - 2 * FLOOR_PAD) / 0.78))
    const rowPitch = (across - 2 * FLOOR_PAD) / labels.length
    const pitch = (along - 2 * FLOOR_PAD) / count
    const byPos = new Map(seats.map((s) => [`${keyOf(s.row)}|${s.seat}`, s]))
    radius = 0.36 * Math.min(rowPitch, pitch)
    labelSize = Math.min(rowPitch * 0.55, 0.5)
    // Row 1 on the side facing the ring.
    const towardRing = horizontal ? dy > 0 : dx > 0
    labels.forEach((label, i) => {
      const off = FLOOR_PAD + (i + 0.5) * rowPitch
      const a = towardRing ? across - off : off
      for (let s = 1; s <= count; s++) {
        const b = FLOOR_PAD + (s - 0.5) * pitch
        const x = horizontal ? rect.x + b : rect.x + a
        const y = horizontal ? rect.y + a : rect.y + b
        out.push({ n: s, row: label, x: r3(x), y: r3(y), seat: byPos.get(`${label}|${s}`) ?? null })
      }
    })
  }

  const ours = out.filter((s) => s.seat)
  const pool = ours.some((s) => s.seat!.free) ? ours.filter((s) => s.seat!.free) : ours
  const focus = pool.length
    ? { x: r3(pool.reduce((t, s) => t + s.x, 0) / pool.length), y: r3(pool.reduce((t, s) => t + s.y, 0) / pool.length) }
    : { x: block.cx, y: block.cy }
  const grey = radius * 0.85
  const others = out
    .filter((s) => !s.seat)
    .map((s) => circle(s.x, s.y, grey))
    .join('')

  return { seats: out, radius: r3(radius), rowLabels, labelSize: r3(labelSize), focus, others }
}
