'use client'

import { Maximize2, Minus, Plus } from 'lucide-react'

/** Zoom in / out / whole-map buttons, bottom-right over a pan-zoom map. */
export function ZoomControls({
  onIn,
  onOut,
  onReset,
  canOut,
  labels,
}: {
  onIn: () => void
  onOut: () => void
  onReset: () => void
  canOut: boolean
  labels: { zoomIn: string; zoomOut: string; reset: string }
}) {
  const btn = 'flex h-10 w-10 items-center justify-center text-white/80 transition hover:bg-white/10 disabled:opacity-30'
  return (
    <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-white/15 bg-ink-950/85 backdrop-blur">
      <button type="button" onClick={onIn} aria-label={labels.zoomIn} className={btn}>
        <Plus className="h-4 w-4" />
      </button>
      <button type="button" onClick={onOut} disabled={!canOut} aria-label={labels.zoomOut} className={`${btn} border-t border-white/10`}>
        <Minus className="h-4 w-4" />
      </button>
      <button type="button" onClick={onReset} disabled={!canOut} aria-label={labels.reset} className={`${btn} border-t border-white/10`}>
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
