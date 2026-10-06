'use client'

import { ChevronUp, Sparkles, X } from 'lucide-react'
import { rowsOf, seatKeyOf } from '@/lib/seats/pick'
import type { PublicSeat } from '@/lib/seats/types'

// Close-up of one block (phase 43): every seat AlbaGo holds in it, row by
// row, front row first. Free seats toggle on tap; taken ones are shown so the
// layout reads like the real block. The panel pre-selects the best seats.

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
  }
  disabled?: boolean
}

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

      <p className="mt-3 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        <ChevronUp className="h-3.5 w-3.5" />
        {labels.toward}
      </p>

      <div className="mt-2 space-y-2.5">
        {rows.map(({ row, seats: rowSeats }) => (
          <div key={row}>
            <span className="block text-[11px] font-semibold text-white/45">
              {labels.row} {row}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {rowSeats.map((s) => {
                const key = seatKeyOf(s)
                const isPicked = picked.has(key)
                const canPick = s.free && !disabled && (isPicked || !maxReached)
                return (
                  <span key={key} className="flex items-center gap-1.5">
                    {s.gapBefore && <span className="px-0.5 text-xs text-white/25" aria-hidden>···</span>}
                    <button
                      type="button"
                      onClick={() => canPick && onToggle(key)}
                      disabled={!s.free || disabled}
                      aria-pressed={isPicked}
                      aria-label={`${labels.row} ${row}, ${s.seat}${s.free ? '' : ` — ${labels.taken}`}`}
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border text-[12px] font-bold tabular-nums transition ${
                        isPicked
                          ? 'border-white text-white shadow-glow-flame'
                          : s.free
                            ? 'border-white/20 bg-white/[0.05] text-white/85 hover:border-white/45 hover:bg-white/[0.1]'
                            : 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-white/20 line-through'
                      } ${!isPicked && s.free && maxReached ? 'opacity-40' : ''}`}
                      style={isPicked ? { backgroundColor: color } : undefined}
                    >
                      {s.seat}
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        ))}
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
