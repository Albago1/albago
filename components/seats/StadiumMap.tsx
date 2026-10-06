'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { freeInBlock } from '@/lib/seats/pick'
import type { FreeRun, PublicSeatBlock } from '@/lib/seats/types'
import { allBlocks, findBlock, type VenueMap } from '@/lib/seats/venueMaps'

// Interactive stadium map for seat sales (phase 43), Eventim-style: the whole
// venue with every block numbered; blocks AlbaGo has seats in are coloured by
// price, the rest grey. Pinch / drag / wheel / double-tap / buttons to zoom;
// tapping one of AlbaGo's blocks zooms onto it and hands it to the panel,
// which opens the seat plan.

type Props = {
  map: VenueMap
  blocks: PublicSeatBlock[]
  runs: FreeRun[]
  colorFor: (category: string) => string
  /** Stock block highlighted on the map (area|block), or null. */
  activeKey: string | null
  /** Stock block the map zooms onto (the one opened in the seat plan). */
  focusKey: string | null
  onSelect: (block: PublicSeatBlock) => void
  labels: {
    floor: string
    ring: string
    blockFree: (block: string, free: number) => string
    zoomIn: string
    zoomOut: string
    reset: string
    legendFree: string
    legendSoldOut: string
    legendOther: string
  }
  disabled?: boolean
}

type View = { x: number; y: number; w: number; h: number }

const keyOf = (b: PublicSeatBlock) => `${b.area}|${b.block}`
const MAX_ZOOM = 6
const TAP_SLOP = 6 // px a pointer may move and still count as a tap

export default function StadiumMap({
  map,
  blocks,
  runs,
  colorFor,
  activeKey,
  focusKey,
  onSelect,
  labels,
  disabled,
}: Props) {
  const full: View = useMemo(() => ({ x: 0, y: 0, w: map.viewBox.w, h: map.viewBox.h }), [map])
  const all = useMemo(() => allBlocks(map), [map])
  const stock = useMemo(
    () =>
      blocks
        .map((b) => {
          const shape = findBlock(map, all, b.area, b.block)
          return shape ? { block: b, shape, free: freeInBlock(runs, b) } : null
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [map, all, blocks, runs],
  )
  const stockShapes = useMemo(() => new Set(stock.map((s) => s.shape)), [stock])

  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>(full)
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])
  const anim = useRef<number | null>(null)

  const clamp = useCallback(
    (v: View): View => {
      const w = Math.min(full.w, Math.max(full.w / MAX_ZOOM, v.w))
      const h = (w * full.h) / full.w
      const x = Math.min(full.w - w * 0.5, Math.max(-w * 0.5 + 0, v.x))
      const y = Math.min(full.h - h * 0.5, Math.max(-h * 0.5 + 0, v.y))
      return w >= full.w ? { ...full } : { x, y, w, h }
    },
    [full],
  )

  const animateTo = useCallback(
    (target: View) => {
      if (anim.current) cancelAnimationFrame(anim.current)
      const from = viewRef.current
      const to = clamp(target)
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 380)
        const e = 1 - Math.pow(1 - t, 3)
        setView({
          x: from.x + (to.x - from.x) * e,
          y: from.y + (to.y - from.y) * e,
          w: from.w + (to.w - from.w) * e,
          h: from.h + (to.h - from.h) * e,
        })
        if (t < 1) anim.current = requestAnimationFrame(step)
      }
      anim.current = requestAnimationFrame(step)
    },
    [clamp],
  )

  const zoomAround = useCallback(
    (factor: number, cx: number, cy: number, animate = false) => {
      const v = viewRef.current
      const w = Math.min(full.w, Math.max(full.w / MAX_ZOOM, v.w / factor))
      const k = w / v.w
      const next = { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w, h: v.h * k }
      if (animate) animateTo(next)
      else setView(clamp(next))
    },
    [full, clamp, animateTo],
  )

  // Zoom onto the block whose seat plan is open; back out when it closes.
  const lastFocus = useRef<string | null>(null)
  useEffect(() => {
    if (focusKey === lastFocus.current) return
    const hadFocus = lastFocus.current !== null
    lastFocus.current = focusKey
    const target = focusKey ? stock.find((s) => keyOf(s.block) === focusKey) : null
    if (target) {
      const w = full.w / 2.6
      const h = (w * full.h) / full.w
      animateTo({ x: target.shape.cx - w / 2, y: target.shape.cy - h / 2, w, h })
    } else if (hadFocus) {
      animateTo(full)
    }
  }, [focusKey, stock, full, animateTo])

  // ---- gestures --------------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{
    startView: View
    startX: number
    startY: number
    startDist: number
    moved: number
    dragging: boolean
  } | null>(null)
  const suppressClick = useRef(false)

  const toSvg = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return {
      x: v.x + ((clientX - rect.left) / rect.width) * v.w,
      y: v.y + ((clientY - rect.top) / rect.height) * v.h,
    }
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (anim.current) cancelAnimationFrame(anim.current)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    suppressClick.current = false
    gesture.current = {
      startView: viewRef.current,
      startX: pts.length === 2 ? (pts[0].x + pts[1].x) / 2 : e.clientX,
      startY: pts.length === 2 ? (pts[0].y + pts[1].y) / 2 : e.clientY,
      startDist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      moved: 0,
      dragging: false,
    }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const rect = svgRef.current!.getBoundingClientRect()
    const pts = [...pointers.current.values()]

    if (pts.length >= 2 && g.startDist > 0) {
      // Pinch: zoom around the start midpoint, follow the fingers.
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const midX = (pts[0].x + pts[1].x) / 2
      const midY = (pts[0].y + pts[1].y) / 2
      const sv = g.startView
      const w = Math.min(full.w, Math.max(full.w / MAX_ZOOM, (sv.w * g.startDist) / dist))
      const k = w / sv.w
      const ax = sv.x + ((g.startX - rect.left) / rect.width) * sv.w
      const ay = sv.y + ((g.startY - rect.top) / rect.height) * sv.h
      const nx = ax - ((midX - rect.left) / rect.width) * w
      const ny = ay - ((midY - rect.top) / rect.height) * sv.h * k
      setView(clamp({ x: nx, y: ny, w, h: sv.h * k }))
      g.dragging = true
      suppressClick.current = true
      return
    }

    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    g.moved = Math.max(g.moved, Math.hypot(dx, dy))
    const zoomedIn = g.startView.w < full.w - 0.5
    if (!zoomedIn || g.moved < TAP_SLOP) return
    if (!g.dragging) {
      g.dragging = true
      try {
        svgRef.current?.setPointerCapture(e.pointerId)
      } catch {
        /* pointer already gone — panning still works without capture */
      }
    }
    suppressClick.current = true
    const sv = g.startView
    setView(
      clamp({
        ...sv,
        x: sv.x - (dx / rect.width) * sv.w,
        y: sv.y - (dy / rect.height) * sv.h,
      }),
    )
  }

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) gesture.current = null
    else if (gesture.current) {
      // One finger left after a pinch: continue as a pan from here.
      const [p] = [...pointers.current.values()]
      gesture.current = { startView: viewRef.current, startX: p.x, startY: p.y, startDist: 0, moved: TAP_SLOP, dragging: true }
    }
  }

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = toSvg(e.clientX, e.clientY)
      zoomAround(Math.exp(-e.deltaY * 0.0018), p.x, p.y)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [zoomAround])

  const zoomedIn = view.w < full.w - 0.5
  const centerX = view.x + view.w / 2
  const centerY = view.y + view.h / 2
  const ringHalf = map.ring.size / 2
  const { field } = map

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`${view.x.toFixed(2)} ${view.y.toFixed(2)} ${view.w.toFixed(2)} ${view.h.toFixed(2)}`}
        className={`h-auto w-full select-none ${zoomedIn ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ touchAction: zoomedIn ? 'none' : 'pan-y', aspectRatio: `${full.w} / ${full.h}` }}
        role="group"
        aria-label={map.name}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={(e) => {
          const p = toSvg(e.clientX, e.clientY)
          zoomAround(2, p.x, p.y, true)
        }}
      >
        {/* Field */}
        <rect
          x={field.x0}
          y={field.y0}
          width={field.x1 - field.x0}
          height={field.y1 - field.y0}
          fill="rgba(255,255,255,0.025)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={0.6}
        />
        <rect
          x={map.ringside.x}
          y={map.ringside.y}
          width={map.ringside.w}
          height={map.ringside.h}
          fill="rgba(255,255,255,0.03)"
        />
        <text
          x={(field.x0 + field.x1) / 2}
          y={field.y1 - 4}
          textAnchor="middle"
          fontSize={5}
          letterSpacing={1}
          fill="rgba(255,255,255,0.3)"
        >
          {labels.floor.toUpperCase()}
        </text>

        {/* Every block of the venue */}
        {all.map((b, i) => {
          if (stockShapes.has(b)) return null
          const common = {
            fill: b.tier === -1 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.05)',
            stroke: '#08080c',
            strokeWidth: 0.9,
          }
          return (
            <g key={`b${i}`} pointerEvents="none">
              {b.d && <path d={b.d} {...common} />}
              {b.rect && <rect x={b.rect.x} y={b.rect.y} width={b.rect.w} height={b.rect.h} rx={1} {...common} />}
              {b.label && (
                <text
                  x={b.cx}
                  y={b.cy + (b.rect ? 1.5 : 2)}
                  textAnchor="middle"
                  fontSize={b.rect ? 3.8 : 5.6}
                  fill="rgba(255,255,255,0.32)"
                >
                  {b.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Ring */}
        <rect
          x={map.ring.cx - ringHalf}
          y={map.ring.cy - ringHalf}
          width={map.ring.size}
          height={map.ring.size}
          fill="rgba(238,28,37,0.18)"
          stroke="#ee1c25"
          strokeWidth={1}
        />
        <rect
          x={map.ring.cx - ringHalf + 2.5}
          y={map.ring.cy - ringHalf + 2.5}
          width={map.ring.size - 5}
          height={map.ring.size - 5}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={0.45}
        />
        <text
          x={map.ring.cx}
          y={map.ring.cy + 1.8}
          textAnchor="middle"
          fontSize={5}
          fontWeight={700}
          letterSpacing={0.6}
          fill="rgba(255,255,255,0.85)"
          pointerEvents="none"
        >
          {labels.ring.toUpperCase()}
        </text>

        {/* Stand label */}
        <text
          x={12}
          y={(field.y0 + field.y1) / 2}
          textAnchor="middle"
          fontSize={7}
          fontWeight={700}
          letterSpacing={1.4}
          fill="rgba(255,255,255,0.5)"
          transform={`rotate(-90 12 ${(field.y0 + field.y1) / 2})`}
          pointerEvents="none"
        >
          {map.leftStandLabel.toUpperCase()}
        </text>

        {/* AlbaGo's blocks, on top */}
        {stock.map(({ block, shape, free }) => {
          const color = colorFor(block.category)
          const key = keyOf(block)
          const active = key === activeKey
          const soldOut = free <= 0
          const clickable = !soldOut && !disabled
          const common = {
            fill: soldOut ? 'rgba(255,255,255,0.1)' : color,
            fillOpacity: soldOut ? 1 : active ? 1 : 0.62,
            stroke: active ? '#ffffff' : soldOut ? 'rgba(255,255,255,0.3)' : color,
            strokeWidth: active ? 1.4 : 0.9,
            strokeDasharray: soldOut ? '2 1.5' : undefined,
            style: active ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined,
          }
          return (
            <g
              key={key}
              role="button"
              tabIndex={clickable ? 0 : -1}
              aria-pressed={active}
              aria-disabled={!clickable}
              aria-label={labels.blockFree(shape.label ?? block.block, free)}
              onClick={() => {
                if (suppressClick.current || !clickable) return
                onSelect(block)
              }}
              onKeyDown={(e) => {
                if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onSelect(block)
                }
              }}
              className={clickable ? 'cursor-pointer outline-none' : 'cursor-not-allowed outline-none'}
            >
              <title>{labels.blockFree(shape.label ?? block.block, free)}</title>
              {shape.d && <path d={shape.d} {...common} />}
              {shape.rect && (
                <rect x={shape.rect.x} y={shape.rect.y} width={shape.rect.w} height={shape.rect.h} rx={1} {...common} />
              )}
              <text
                x={shape.cx}
                y={Math.round((shape.cy + (shape.rect ? 1.6 : 2.2)) * 100) / 100}
                textAnchor="middle"
                fontSize={shape.rect ? 4.4 : 6.4}
                fontWeight={800}
                fill={soldOut ? 'rgba(255,255,255,0.45)' : '#ffffff'}
                pointerEvents="none"
              >
                {shape.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Zoom controls */}
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-xl border border-white/15 bg-ink-950/80 backdrop-blur">
        <button
          type="button"
          onClick={() => zoomAround(1.6, centerX, centerY, true)}
          aria-label={labels.zoomIn}
          className="flex h-9 w-9 items-center justify-center text-white/80 transition hover:bg-white/10"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomAround(1 / 1.6, centerX, centerY, true)}
          disabled={!zoomedIn}
          aria-label={labels.zoomOut}
          className="flex h-9 w-9 items-center justify-center border-t border-white/10 text-white/80 transition hover:bg-white/10 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => animateTo(full)}
          disabled={!zoomedIn}
          aria-label={labels.reset}
          className="flex h-9 w-9 items-center justify-center border-t border-white/10 text-white/80 transition hover:bg-white/10 disabled:opacity-30"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-white/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-gradient-to-r from-flame-500 via-amber-400 to-sky-400" aria-hidden /> {labels.legendFree}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-white/40" aria-hidden /> {labels.legendSoldOut}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-white/10" aria-hidden /> {labels.legendOther}
        </span>
      </div>
    </div>
  )
}
