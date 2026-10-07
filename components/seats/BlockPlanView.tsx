'use client'

import { useMemo, useRef, useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { seatKeyOf } from '@/lib/seats/pick'
import type { SeatPlan } from '@/lib/seats/blockPlan'
import type { PublicSeat } from '@/lib/seats/types'
import { ZoomControls } from './StadiumMap'
import { usePanZoom, type Box } from './usePanZoom'

// One block's seat plan (phase 43), inside the full-screen seat picker: ring
// at the top, every row and seat of the block. AlbaGo's seats are coloured
// and tappable; picked ones turn white with a check; sold ones are crossed
// out; every other seat is a grey dot. Opens zoomed onto AlbaGo's seats when
// the whole block would be too small to tap; pinch / drag / wheel to move.

type Props = {
  plan: SeatPlan
  color: string
  picked: Set<string>
  onToggle: (seat: PublicSeat) => void
  /** Price shown in the seat tooltip. */
  price: string
  labels: {
    row: string
    seat: string
    ring: string
    taken: string
    zoomIn: string
    zoomOut: string
    reset: string
    legendFree: string
    legendPicked: string
    legendTaken: string
    legendOther: string
  }
  disabled?: boolean
}

// The plan opens showing whole rows when seats are still easy to tap at that
// size; otherwise it zooms in around AlbaGo's seats to a tappable pitch.
const MIN_FULL_ROW_PX = 15
const TARGET_PX = 18

export default function BlockPlanView({ plan, color, picked, onToggle, price, labels, disabled }: Props) {
  const content = useMemo<Box>(() => ({ x: 0, y: 0, w: plan.width, h: plan.height }), [plan])
  const pz = usePanZoom({
    content,
    maxZoom: 8,
    pad: 0.03,
    initial: (home, px) => {
      if (!plan.focus) return null
      const f = plan.focus
      const fullRows = Math.max(1, home.w / (plan.width * 1.04))
      if (px * fullRows >= MIN_FULL_ROW_PX) {
        return { cx: plan.width / 2, cy: f.y + f.h / 2, k: fullRows }
      }
      const k = Math.max(1, Math.min(TARGET_PX / px, home.w / f.w, home.h / f.h))
      return { cx: f.x + f.w / 2, cy: f.y + f.h / 2, k }
    },
  })
  const wrapRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)

  const { view, size, pxPerUnit } = pz
  const r = plan.radius
  const showNumbers = pxPerUnit >= 20
  const ROW_PX = pxPerUnit * 1.32

  // Every seat that isn't AlbaGo's, as one path (cheap to draw).
  const others = useMemo(() => {
    const d: string[] = []
    const g = r * 0.82
    for (const row of plan.rows) {
      for (const s of row.seats) {
        if (s.seat) continue
        d.push(`M${(s.x - g).toFixed(3)} ${s.y}a${g} ${g} 0 1 0 ${2 * g} 0a${g} ${g} 0 1 0 ${-2 * g} 0`)
      }
    }
    return d.join('')
  }, [plan, r])
  const ours = useMemo(() => plan.rows.flatMap((row) => row.seats.filter((s) => s.seat)), [plan])

  const tipAt = (text: string) => (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const rect = wrapRef.current?.getBoundingClientRect()
    if (rect) setTip({ text, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  // Row numbers pinned to the left edge once the rows' own labels scroll
  // off-screen (judged by the row in the middle of the view).
  const midY = view.y + view.h / 2
  const midRow = plan.rows.reduce<(typeof plan.rows)[number] | null>(
    (best, row) => (!best || Math.abs(row.y - midY) < Math.abs(best.y - midY) ? row : best),
    null,
  )
  const ruler = !!size && !!midRow && midRow.labelLeft < view.x + 0.9 && ROW_PX >= 15
  const stageHidden = view.y > plan.stage.y + plan.stage.h * 0.6

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <svg
        {...pz.svgProps}
        className={`h-full w-full select-none ${pz.zoom > 1.01 ? 'cursor-grab active:cursor-grabbing' : ''}`}
        role="group"
        aria-label={labels.ring}
        onPointerLeave={() => setTip(null)}
      >
        {/* Ring side */}
        <rect
          x={plan.stage.x}
          y={plan.stage.y}
          width={plan.stage.w}
          height={plan.stage.h}
          rx={0.5}
          fill="rgba(238,28,37,0.16)"
          stroke="rgba(238,28,37,0.55)"
          strokeWidth={0.06}
        />
        <text
          x={plan.stage.x + plan.stage.w / 2}
          y={plan.stage.y + plan.stage.h / 2 + 0.22}
          textAnchor="middle"
          fontSize={0.62}
          fontWeight={700}
          letterSpacing={0.12}
          fill="rgba(255,255,255,0.75)"
        >
          ▲ {labels.ring.toUpperCase()}
        </text>

        <path d={plan.outline} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.05} />

        {/* Row numbers, both ends */}
        {plan.rows.map((row) => (
          <g key={row.label} fontSize={0.5} fontWeight={700} fill="rgba(255,255,255,0.4)" textAnchor="middle" pointerEvents="none">
            <text x={row.labelLeft} y={row.y + 0.18}>
              {row.label}
            </text>
            <text x={row.labelRight} y={row.y + 0.18}>
              {row.label}
            </text>
          </g>
        ))}

        <path d={others} fill="rgba(255,255,255,0.12)" pointerEvents="none" />

        {/* AlbaGo's seats */}
        {ours.map(({ n, x, y, seat }) => {
          const s = seat!
          const key = seatKeyOf(s)
          const isPicked = picked.has(key)
          const tipText = `${labels.row} ${s.row} · ${labels.seat} ${n}${s.free ? ` · ${price}` : ` · ${labels.taken}`}`
          return (
            <g
              key={key}
              role="button"
              tabIndex={s.free && !disabled ? 0 : -1}
              aria-pressed={isPicked}
              aria-disabled={!s.free || disabled}
              aria-label={tipText}
              className={s.free && !disabled ? 'cursor-pointer outline-none' : 'cursor-not-allowed outline-none'}
              onClick={() => {
                if (pz.suppressClick.current || !s.free || disabled) return
                onToggle(s)
              }}
              onKeyDown={(e) => {
                if (s.free && !disabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onToggle(s)
                }
              }}
              onPointerEnter={tipAt(tipText)}
              onPointerLeave={() => setTip(null)}
            >
              {/* Generous hit area: the whole seat cell. */}
              <rect x={x - 0.5} y={y - 0.62} width={1} height={1.24} fill="transparent" />
              {isPicked && <circle cx={x} cy={y} r={r + 0.14} fill="none" stroke={color} strokeWidth={0.1} />}
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={isPicked ? '#ffffff' : s.free ? color : 'rgba(255,255,255,0.08)'}
                stroke={s.free ? (isPicked ? '#ffffff' : 'rgba(255,255,255,0.55)') : 'rgba(255,255,255,0.25)'}
                strokeWidth={0.05}
              />
              {isPicked ? (
                <path
                  d={`M${x - 0.17} ${y + 0.01} l0.12 0.13 l0.24 -0.27`}
                  fill="none"
                  stroke={color}
                  strokeWidth={0.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : !s.free ? (
                <path d={`M${x - 0.18} ${y - 0.18} l0.36 0.36 M${x + 0.18} ${y - 0.18} l-0.36 0.36`} stroke="rgba(255,255,255,0.35)" strokeWidth={0.06} />
              ) : showNumbers ? (
                <text x={x} y={y + 0.15} textAnchor="middle" fontSize={0.42} fontWeight={800} fill="#ffffff" pointerEvents="none">
                  {n}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>

      {ruler && size && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-ink-950/90 to-transparent">
          {plan.rows.map((row) => {
            const top = ((row.y - view.y) / view.h) * size.h
            if (top < 8 || top > size.h - 8) return null
            return (
              <span key={row.label} className="absolute left-1.5 -translate-y-1/2 text-[10px] font-bold tabular-nums text-white/55" style={{ top }}>
                {row.label}
              </span>
            )
          })}
        </div>
      )}

      {stageHidden && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full border border-flame-500/40 bg-ink-950/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-flame-100/90 backdrop-blur">
            <ChevronUp className="h-3.5 w-3.5" />
            {labels.ring}
          </span>
        </div>
      )}

      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-lg border border-white/15 bg-ink-950/95 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xl"
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </div>
      )}

      <ZoomControls
        onIn={() => pz.zoomBy(1.6)}
        onOut={() => pz.zoomBy(1 / 1.6)}
        onReset={pz.reset}
        canOut={pz.zoom > 1.01}
        labels={{ zoomIn: labels.zoomIn, zoomOut: labels.zoomOut, reset: labels.reset }}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-4.5rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-ink-950/75 px-2.5 py-1.5 text-[10px] text-white/60 backdrop-blur">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-white/50" style={{ backgroundColor: color }} aria-hidden />
          {labels.legendFree}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 bg-white" style={{ borderColor: color }} aria-hidden />
          {labels.legendPicked}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-white/25 bg-white/[0.08]" aria-hidden />
          {labels.legendTaken}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" aria-hidden />
          {labels.legendOther}
        </span>
      </div>
    </div>
  )
}
