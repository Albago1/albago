'use client'

import { Check, ChevronUp, Sparkles, X } from 'lucide-react'
import { rowsOf, seatKeyOf } from '@/lib/seats/pick'
import type { PublicSeat } from '@/lib/seats/types'

// Seat plan of one block (phase 43), Eventim-style: round seats in rows,
// front row first. AlbaGo's seats are coloured and tappable (sold ones
// crossed out); the other seats of the row are drawn grey so the row reads
// like the real one, with long stretches shortened to "···".

type Props = {
  title: string
  subtitle: string
  seats: PublicSeat[]
  picked: Set<string>
  color: string
  maxReached: boolean
  onToggle: (key: string) => void
  onBest: () => void
  onClear: () => void
  onClose: () => void
  labels: {
    row: string
    toward: string
    hint: string
    best: string
    clear: string
    close: string
    taken: string
    max: string
    legendFree: string
    legendPicked: string
    legendTaken: string
    legendOther: string
  }
  disabled?: boolean
}

type Item =
  | { kind: 'seat'; seat: PublicSeat }
  | { kind: 'other'; n: number }
  | { kind: 'gap'; id: string }

/** One row: AlbaGo's seats plus the other seats around them, shortened. */
export function rowItems(seats: PublicSeat[]): Item[] {
  const sorted = [...seats].sort((a, b) => a.seat - b.seat)
  const items: Item[] = []
  const first = sorted[0]?.seat ?? 1
  if (first > 2) items.push({ kind: 'gap', id: 'lead' })
  if (first > 1) items.push({ kind: 'other', n: first - 1 })
  sorted.forEach((s, i) => {
    if (i > 0) {
      const prev = sorted[i - 1].seat
      const gap = s.seat - prev - 1
      if (gap > 2) items.push({ kind: 'gap', id: `g${prev}` })
      else for (let n = prev + 1; n < s.seat; n++) items.push({ kind: 'other', n })
    }
    items.push({ kind: 'seat', seat: s })
  })
  return items
}

const DOT = 'flex h-[25px] w-[25px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums'

export default function BlockSeatPicker({
  title,
  subtitle,
  seats,
  picked,
  color,
  maxReached,
  onToggle,
  onBest,
  onClear,
  onClose,
  labels,
  disabled,
}: Props) {
  const rows = rowsOf(seats)

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-ink-950/50 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
            {title}
          </p>
          <p className="mt-0.5 text-xs text-white/55">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.close}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stage / ring direction */}
      <div className="mt-3 flex items-center justify-center">
        <span className="inline-flex items-center gap-1 rounded-full border border-flame-500/30 bg-flame-500/10 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-flame-100/80">
          <ChevronUp className="h-3.5 w-3.5" />
          {labels.toward}
        </span>
      </div>

      <div className="mt-3 space-y-2 overflow-x-auto pb-1">
        {rows.map(({ row, seats: rowSeats }) => (
          <div key={row} className="flex items-center gap-[3px]">
            <span className="w-[22px] flex-shrink-0 text-center text-[10px] font-bold text-white/45" title={`${labels.row} ${row}`}>
              {row}
            </span>
            {rowItems(rowSeats).map((item) => {
              if (item.kind === 'gap') {
                return (
                  <span key={item.id} className="w-3 flex-shrink-0 text-center text-[10px] text-white/25" aria-hidden>
                    ···
                  </span>
                )
              }
              if (item.kind === 'other') {
                return (
                  <span key={`o${item.n}`} className={`${DOT} border border-white/[0.07] bg-white/[0.03] text-white/20`} aria-hidden>
                    {item.n}
                  </span>
                )
              }
              const s = item.seat
              const key = seatKeyOf(s)
              const isPicked = picked.has(key)
              const canPick = s.free && !disabled && (isPicked || !maxReached)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => canPick && onToggle(key)}
                  disabled={!s.free || disabled}
                  aria-pressed={isPicked}
                  aria-label={`${labels.row} ${row}, ${s.seat}${s.free ? '' : ` — ${labels.taken}`}`}
                  className={`${DOT} border-2 transition ${
                    isPicked
                      ? 'border-white text-white shadow-glow-flame'
                      : s.free
                        ? 'text-white hover:scale-110'
                        : 'cursor-not-allowed border-white/15 bg-white/[0.04] text-white/25 line-through'
                  } ${!isPicked && s.free && maxReached ? 'opacity-40' : ''}`}
                  style={
                    isPicked
                      ? { backgroundColor: color }
                      : s.free
                        ? { borderColor: color, backgroundColor: `${color}2e` }
                        : undefined
                  }
                >
                  {isPicked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.seat}
                </button>
              )
            })}
            <span className="hidden w-[22px] flex-shrink-0 text-center text-[10px] font-bold text-white/45 sm:block" aria-hidden>
              {row}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: color, backgroundColor: `${color}2e` }} aria-hidden />
          {labels.legendFree}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          {labels.legendPicked}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-white/15 bg-white/[0.04]" aria-hidden />
          {labels.legendTaken}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-white/[0.07] bg-white/[0.03]" aria-hidden />
          {labels.legendOther}
        </span>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-white/45">{maxReached ? labels.max : labels.hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBest}
          disabled={disabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-flame-500/40 bg-flame-500/10 px-3 text-xs font-semibold text-flame-100 transition hover:bg-flame-500/20 disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {labels.best}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || picked.size === 0}
          className="inline-flex h-8 items-center rounded-full border border-white/10 px-3 text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] disabled:opacity-40"
        >
          {labels.clear}
        </button>
      </div>
    </div>
  )
}
