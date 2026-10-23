'use client'

import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import { allBlocks, pointOn, SIDES, type MapBlock, type Pt, type VenueMap } from '@/lib/seats/venueMaps'
import { memberOf, sideOfBlock, type OfficialSeatGuide } from '@/lib/seats/officialGuides'
import { usePanZoom, type Box } from './usePanZoom'
import { ZoomControls } from './ZoomControls'

/**
 * The stadium guide's map: the arena split into the two fighters' sides,
 * a white line where one side ends and the other begins, blocks with free
 * seats in their side's colour and sold-out blocks black. Inline it is a
 * static picture (the page scrolls over it); `zoomable` fills its box with
 * pinch / drag / wheel zoom for the full-screen view.
 */

export type BlockSide = 0 | 1 | 'ring'

type Props = {
  map: VenueMap
  guide: OfficialSeatGuide
  /** Blocks with free seats; null = no snapshot (blocks show their side colour). */
  free: Set<string> | null
  /** Side in focus; the rest of the arena dims. */
  focus: 0 | 1 | null
  activeLabel: string | null
  labels: { floor: string; ring: string; title: string }
  describe: (b: MapBlock, side: BlockSide) => string
  onBlock: (b: MapBlock, side: BlockSide) => void
  /** Fill the parent box with pan + zoom (the parent must be positioned). */
  zoomable?: { zoomIn: string; zoomOut: string; reset: string }
}

const SOLD_FILL = '#08080b'

/** Camera showing `box` within the home view. */
const camOn = (box: Box, home: Box) => ({
  cx: box.x + box.w / 2,
  cy: box.y + box.h / 2,
  k: Math.max(1, Math.min(home.w / box.w, home.h / box.h)),
})

/** A box around a side's blocks, with a little air, to fly the camera to. */
function sideBox(blocks: MapBlock[], guide: OfficialSeatGuide, side: 0 | 1): Box {
  const own = blocks.filter((b) => sideOfBlock(guide, b) === side)
  const x0 = Math.min(...own.map((b) => b.box.x0))
  const y0 = Math.min(...own.map((b) => b.box.y0))
  const x1 = Math.max(...own.map((b) => b.box.x1))
  const y1 = Math.max(...own.map((b) => b.box.y1))
  const m = 6
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m }
}

/** Lines across the bowl where one side's blocks meet the other's, one per boundary (lower + upper tier joined). */
function dividers(map: VenueMap, guide: OfficialSeatGuide): Pt[][] {
  const edges = map.tiers.map((tier) => {
    const seq = SIDES.flatMap((side) =>
      tier.sides[side].map((label, i, all) => ({ side, f: (i + 1) / all.length, m: memberOf(guide, label, side) })),
    )
    return seq.flatMap((cur, k) => {
      const next = seq[(k + 1) % seq.length]
      return cur.m !== null && next.m !== null && cur.m !== next.m ? [{ side: cur.side, f: cur.f, key: `${cur.m}>${next.m}` }] : []
    })
  })
  const [lower = [], upper = []] = edges
  const [t0, t1] = map.tiers
  const used = new Set<number>()
  const lines = lower.map((e) => {
    const j = upper.findIndex((u, k) => !used.has(k) && u.key === e.key && u.side === e.side)
    const pts: Pt[] = [pointOn(map.field, e.side, e.f, t0.inner), pointOn(map.field, e.side, e.f, t0.outer)]
    if (j >= 0 && t1) {
      used.add(j)
      const u = upper[j]
      pts.push(pointOn(map.field, u.side, u.f, t1.inner), pointOn(map.field, u.side, u.f, t1.outer + 3))
    }
    return pts
  })
  upper.forEach((u, k) => {
    if (!used.has(k) && t1) lines.push([pointOn(map.field, u.side, u.f, t1.inner), pointOn(map.field, u.side, u.f, t1.outer + 3)])
  })
  return lines
}

const ptsAttr = (pts: Pt[]) => pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')

export const GuideMap = memo(function GuideMap({ map, guide, free, focus, activeLabel, labels, describe, onBlock, zoomable }: Props) {
  const uid = useId().replace(/:/g, '')
  const blocks = allBlocks(map)
  const lines = useMemo(() => dividers(map, guide), [map, guide])
  const frame = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const { field } = map
  const midY = (field.y0 + field.y1) / 2
  const ringHalf = map.ring.size / 2
  const [left, right] = guide.sides
  const w = map.viewBox.w
  const h = map.viewBox.h

  // Pan + zoom (wired to the svg only when zoomable). A chosen side flies into view.
  const content = useMemo<Box>(() => ({ x: 0, y: 0, w, h }), [w, h])
  const boxes = useMemo(() => [sideBox(blocks, guide, 0), sideBox(blocks, guide, 1)], [blocks, guide])
  const pz = usePanZoom({
    content,
    maxZoom: 8,
    maxPxPerUnit: 9,
    pad: 0.02,
    initial: (home) => (focus === null ? null : camOn(boxes[focus], home)),
  })
  const { focusBox, reset, suppressClick } = pz
  const firstFocus = useRef(true)
  useEffect(() => {
    if (!zoomable) return
    if (firstFocus.current) {
      firstFocus.current = false
      return
    }
    if (focus === null) reset()
    else focusBox(boxes[focus])
  }, [focus, zoomable, boxes, focusBox, reset])

  const hoverAt = (text: string) => (e: React.PointerEvent) => {
    const box = frame.current?.getBoundingClientRect()
    if (e.pointerType === 'mouse' && box) setTip({ text, x: e.clientX - box.left, y: e.clientY - box.top })
  }

  return (
    <div ref={frame} className={zoomable ? 'absolute inset-0' : 'relative'} onPointerLeave={() => setTip(null)}>
      <svg
        {...(zoomable ? pz.svgProps : { viewBox: `0 0 ${w} ${h}`, style: { aspectRatio: `${w} / ${h}` } })}
        className={zoomable ? `h-full w-full select-none ${pz.zoom > 1.01 ? 'cursor-grab active:cursor-grabbing' : ''}` : 'h-auto w-full select-none'}
        role="group"
        aria-label={labels.title}
      >
        <defs>
          {guide.sides.map((s, i) => (
            <radialGradient key={s.key} id={`${uid}-glow${i}`}>
              <stop offset="0%" stopColor={s.color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </radialGradient>
          ))}
          <filter id={`${uid}-lift`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="#ffffff" floodOpacity="0.75" />
          </filter>
        </defs>

        {/* Each side's territory glows behind its stand */}
        <ellipse
          cx={field.x0 - 30}
          cy={midY}
          rx={120}
          ry={175}
          fill={`url(#${uid}-glow0)`}
          opacity={focus === 1 ? 0.15 : focus === 0 ? 1 : 0.6}
          style={{ transition: 'opacity 300ms' }}
        />
        <ellipse
          cx={field.x1 + 30}
          cy={midY}
          rx={120}
          ry={175}
          fill={`url(#${uid}-glow1)`}
          opacity={focus === 0 ? 0.15 : focus === 1 ? 1 : 0.6}
          style={{ transition: 'opacity 300ms' }}
        />

        <rect x={field.x0} y={field.y0} width={field.x1 - field.x0} height={field.y1 - field.y0} rx={3} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.1)" strokeWidth={0.6} />
        <rect x={map.ringside.x} y={map.ringside.y} width={map.ringside.w} height={map.ringside.h} rx={1.5} fill="rgba(255,255,255,0.035)" />
        <text x={(field.x0 + field.x1) / 2} y={field.y1 - 4} textAnchor="middle" fontSize={5} letterSpacing={1} fill="rgba(255,255,255,0.3)" pointerEvents="none">
          {labels.floor.toUpperCase()}
        </text>

        {blocks.map((b, i) => {
          const side = sideOfBlock(guide, b)
          if (side === null) {
            return b.d ? <path key={`u${i}`} d={b.d} fill="rgba(255,255,255,0.04)" stroke="#050505" strokeWidth={0.9} pointerEvents="none" /> : null
          }
          const color = side === 'ring' ? guide.ringside.color : guide.sides[side].color
          const isFree = free ? free.has(b.label!) : null
          const active = activeLabel === b.label
          const dim = focus !== null && side !== focus && !active
          const sold = isFree === false
          const shape = {
            fill: sold ? SOLD_FILL : color,
            fillOpacity: sold ? 1 : isFree === null ? 0.5 : b.tier === 1 ? 0.8 : 0.95,
            stroke: active ? '#ffffff' : sold ? 'rgba(255,255,255,0.1)' : '#050505',
            strokeWidth: active ? 1.6 : 0.9,
            filter: active ? `url(#${uid}-lift)` : undefined,
          }
          const text = describe(b, side)
          return (
            <g
              key={`${b.tier}-${b.label}`}
              role="button"
              tabIndex={0}
              aria-label={text}
              aria-pressed={active}
              opacity={dim ? 0.16 : 1}
              style={{ transition: 'opacity 250ms' }}
              className="cursor-pointer outline-none focus-visible:[&>path]:stroke-white focus-visible:[&>rect]:stroke-white"
              onClick={() => {
                if (!(zoomable && suppressClick.current)) onBlock(b, side)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onBlock(b, side)
                }
              }}
              onPointerEnter={hoverAt(text)}
              onPointerLeave={() => setTip(null)}
            >
              {b.d && <path d={b.d} {...shape} />}
              {b.rect && <rect x={b.rect.x} y={b.rect.y} width={b.rect.w} height={b.rect.h} rx={1} {...shape} />}
              <text
                x={b.cx}
                y={b.cy + (b.rect ? 1.5 : 2)}
                textAnchor="middle"
                fontSize={b.rect ? 3.8 : 5.6}
                fontWeight={800}
                fill={sold ? 'rgba(255,255,255,0.3)' : side === 'ring' ? '#1c1405' : '#ffffff'}
                pointerEvents="none"
              >
                {b.label}
              </text>
            </g>
          )
        })}

        {/* Free blocks of the side in focus breathe, to invite a tap */}
        {focus !== null && !activeLabel && free && (
          <g pointerEvents="none" fill="none" stroke="#ffffff" strokeWidth={0.9} strokeOpacity={0.85} className="animate-pulse">
            {blocks.map((b, i) =>
              b.label && sideOfBlock(guide, b) === focus && free.has(b.label) ? (b.d ? <path key={i} d={b.d} /> : null) : null,
            )}
          </g>
        )}

        {/* Where one side ends and the other begins */}
        <g pointerEvents="none" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {lines.map((pts, i) => (
            <polyline key={`g${i}`} points={ptsAttr(pts)} stroke="#ffffff" strokeOpacity={0.18} strokeWidth={4.5} />
          ))}
          {lines.map((pts, i) => (
            <polyline key={`l${i}`} points={ptsAttr(pts)} stroke="#ffffff" strokeWidth={1.2} />
          ))}
          {lines.map((pts, i) => {
            const end = pts[pts.length - 1]
            return <circle key={`c${i}`} cx={end[0]} cy={end[1]} r={1.9} fill="#ffffff" />
          })}
        </g>

        {/* Ring */}
        <rect x={map.ring.cx - ringHalf} y={map.ring.cy - ringHalf} width={map.ring.size} height={map.ring.size} fill="rgba(238,28,37,0.2)" stroke="#ee1c25" strokeWidth={1} pointerEvents="none" />
        <rect
          x={map.ring.cx - ringHalf + 2.5}
          y={map.ring.cy - ringHalf + 2.5}
          width={map.ring.size - 5}
          height={map.ring.size - 5}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={0.45}
          pointerEvents="none"
        />
        <text x={map.ring.cx} y={map.ring.cy + 1.8} textAnchor="middle" fontSize={5} fontWeight={700} letterSpacing={0.6} fill="rgba(255,255,255,0.85)" pointerEvents="none">
          {labels.ring.toUpperCase()}
        </text>

        {/* Side names along the two ends */}
        <text
          x={12}
          y={midY}
          textAnchor="middle"
          fontSize={7}
          fontWeight={800}
          letterSpacing={1.6}
          fill={left.color}
          transform={`rotate(-90 12 ${midY})`}
          pointerEvents="none"
        >
          {[left.name, left.stand].filter(Boolean).join(' · ').toUpperCase()}
        </text>
        <text
          x={w - 7}
          y={midY}
          textAnchor="middle"
          fontSize={7}
          fontWeight={800}
          letterSpacing={1.6}
          fill={right.color}
          transform={`rotate(90 ${w - 7} ${midY})`}
          pointerEvents="none"
        >
          {[right.name, right.stand].filter(Boolean).join(' · ').toUpperCase()}
        </text>
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/15 bg-ink-950/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg backdrop-blur"
          style={{ left: tip.x, top: tip.y - 8 }}
        >
          {tip.text}
        </div>
      )}
      {zoomable && (
        <ZoomControls onIn={() => pz.zoomBy(2)} onOut={() => pz.zoomBy(0.5)} onReset={reset} canOut={pz.zoom > 1.01} labels={zoomable} />
      )}
    </div>
  )
})
