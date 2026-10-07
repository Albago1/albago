'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { blockKey, freeInBlock } from '@/lib/seats/pick'
import type { FreeRun, PublicSeatBlock } from '@/lib/seats/types'
import { allBlocks, findBlock, type MapBlock, type VenueMap } from '@/lib/seats/venueMaps'
import { usePanZoom, type Box } from './usePanZoom'

// Stadium overview for seat sales (phase 43): the whole venue, every block
// numbered. Blocks AlbaGo has seats in are coloured by price category (dimmed
// when a price filter is on), the rest grey. Three uses:
//   <StadiumMap>      interactive, fills its box — pan / pinch / wheel, hover
//                     tooltips, tap a block to open its seat plan
//   <StadiumPreview>  static picture (event page card, the plan's mini-map)

export type StockBlock = { block: PublicSeatBlock; shape: MapBlock; free: number }

/** AlbaGo's blocks placed on the map (blocks the map doesn't know are left out). */
export function stockOnMap(map: VenueMap, all: MapBlock[], blocks: PublicSeatBlock[], runs: FreeRun[]): StockBlock[] {
  return blocks
    .map((b) => {
      const shape = findBlock(map, all, b.area, b.block)
      return shape ? { block: b, shape, free: freeInBlock(runs, b) } : null
    })
    .filter((x): x is StockBlock => x !== null)
}

type Interaction = {
  onSelect: (block: PublicSeatBlock) => void
  /** A grey block was tapped (touch) — say there is nothing on sale there. */
  onOther: (text: string) => void
  onHover: (info: { text: string; clientX: number; clientY: number } | null) => void
  describe: (s: StockBlock) => string
  describeOther: (label: string) => string
  suppressClick: RefObject<boolean>
  disabled?: boolean
}

type ArtProps = {
  map: VenueMap
  all: MapBlock[]
  stock: StockBlock[]
  colorFor: (category: string) => string
  /** Price category in focus; other categories are dimmed. */
  filter?: string | null
  activeKey?: string | null
  /** Seats picked per block (blockKey → n), shown as a badge. */
  counts?: Map<string, number>
  labels: { floor: string; ring: string }
  /** Mini-map: no block numbers or stand label. */
  mini?: boolean
  interaction?: Interaction
}

/** The stadium drawing itself, in map units. */
export function StadiumArt({ map, all, stock, colorFor, filter, activeKey, counts, labels, mini, interaction }: ArtProps) {
  const stockShapes = new Set(stock.map((s) => s.shape))
  const ringHalf = map.ring.size / 2
  const { field } = map
  const hover = (text: string) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') interaction?.onHover({ text, clientX: e.clientX, clientY: e.clientY })
  }
  const unhover = () => interaction?.onHover(null)

  return (
    <g>
      <rect
        x={field.x0}
        y={field.y0}
        width={field.x1 - field.x0}
        height={field.y1 - field.y0}
        rx={3}
        fill="rgba(255,255,255,0.025)"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={0.6}
      />
      <rect x={map.ringside.x} y={map.ringside.y} width={map.ringside.w} height={map.ringside.h} rx={1.5} fill="rgba(255,255,255,0.035)" />
      {!mini && (
        <text x={(field.x0 + field.x1) / 2} y={field.y1 - 4} textAnchor="middle" fontSize={5} letterSpacing={1} fill="rgba(255,255,255,0.3)" pointerEvents="none">
          {labels.floor.toUpperCase()}
        </text>
      )}

      {/* Every block of the venue */}
      {all.map((b, i) => {
        if (stockShapes.has(b)) return null
        const common = {
          fill: b.tier === -1 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.05)',
          stroke: '#050505',
          strokeWidth: 0.9,
        }
        const text = b.label && interaction ? interaction.describeOther(b.label) : null
        return (
          <g
            key={`b${i}`}
            pointerEvents={text ? undefined : 'none'}
            onPointerEnter={text ? hover(text) : undefined}
            onPointerLeave={text ? unhover : undefined}
            onClick={
              text
                ? () => {
                    if (!interaction!.suppressClick.current) interaction!.onOther(text)
                  }
                : undefined
            }
          >
            {b.d && <path d={b.d} {...common} />}
            {b.rect && <rect x={b.rect.x} y={b.rect.y} width={b.rect.w} height={b.rect.h} rx={1} {...common} />}
            {b.label && !mini && (
              <text
                x={b.cx}
                y={b.cy + (b.rect ? 1.5 : 2)}
                textAnchor="middle"
                fontSize={b.rect ? 3.8 : 5.6}
                fill="rgba(255,255,255,0.3)"
                pointerEvents="none"
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
        fill="rgba(238,28,37,0.2)"
        stroke="#ee1c25"
        strokeWidth={1}
        pointerEvents="none"
      />
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
      {!mini && (
        <text x={map.ring.cx} y={map.ring.cy + 1.8} textAnchor="middle" fontSize={5} fontWeight={700} letterSpacing={0.6} fill="rgba(255,255,255,0.85)" pointerEvents="none">
          {labels.ring.toUpperCase()}
        </text>
      )}

      {!mini && (
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
      )}

      {/* AlbaGo's blocks, on top */}
      {stock.map((s) => {
        const { block, shape, free } = s
        const color = colorFor(block.category)
        const key = blockKey(block)
        const active = key === activeKey
        const soldOut = free <= 0
        const dimmed = !!filter && filter !== block.category && !active
        const clickable = !!interaction && !soldOut && !interaction.disabled
        const count = counts?.get(key) ?? 0
        const common = {
          fill: soldOut ? 'rgba(255,255,255,0.1)' : color,
          fillOpacity: soldOut ? 1 : active ? 1 : dimmed ? 0.16 : 0.72,
          stroke: active ? '#ffffff' : soldOut ? 'rgba(255,255,255,0.3)' : color,
          strokeOpacity: dimmed ? 0.35 : 1,
          strokeWidth: active ? 1.6 : 0.9,
          strokeDasharray: soldOut ? '2 1.5' : undefined,
          style: active && !mini ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined,
        }
        const text = interaction ? interaction.describe(s) : ''
        return (
          <g
            key={key}
            role={interaction ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={interaction ? text : undefined}
            aria-disabled={interaction ? !clickable : undefined}
            onClick={
              interaction
                ? () => {
                    if (interaction.suppressClick.current || !clickable) return
                    interaction.onSelect(block)
                  }
                : undefined
            }
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      interaction!.onSelect(block)
                    }
                  }
                : undefined
            }
            onPointerEnter={interaction ? hover(text) : undefined}
            onPointerLeave={interaction ? unhover : undefined}
            pointerEvents={interaction ? undefined : 'none'}
            className={clickable ? 'cursor-pointer outline-none' : 'outline-none'}
          >
            {shape.d && <path d={shape.d} {...common} />}
            {shape.rect && <rect x={shape.rect.x} y={shape.rect.y} width={shape.rect.w} height={shape.rect.h} rx={1} {...common} />}
            {!mini && (
              <text
                x={shape.cx}
                y={Math.round((shape.cy + (shape.rect ? 1.6 : 2.2)) * 100) / 100}
                textAnchor="middle"
                fontSize={shape.rect ? 4.4 : 6.4}
                fontWeight={800}
                fill={soldOut || dimmed ? 'rgba(255,255,255,0.45)' : '#ffffff'}
                pointerEvents="none"
              >
                {shape.label}
              </text>
            )}
            {count > 0 && !mini && (
              <g pointerEvents="none">
                <circle
                  cx={shape.rect ? shape.rect.x + shape.rect.w : shape.cx + 6.5}
                  cy={shape.rect ? shape.rect.y : shape.cy - 6.5}
                  r={3.8}
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth={0.8}
                />
                <text
                  x={shape.rect ? shape.rect.x + shape.rect.w : shape.cx + 6.5}
                  y={(shape.rect ? shape.rect.y : shape.cy - 6.5) + 1.6}
                  textAnchor="middle"
                  fontSize={4.4}
                  fontWeight={800}
                  fill="#050505"
                >
                  {count}
                </text>
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}

type PreviewProps = Omit<ArtProps, 'all' | 'interaction'> & { className?: string }

/** Static stadium picture (no gestures). */
export function StadiumPreview({ className, ...props }: PreviewProps) {
  const all = useMemo(() => allBlocks(props.map), [props.map])
  const { w, h } = props.map.viewBox
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className ?? 'h-auto w-full'} style={{ aspectRatio: `${w} / ${h}` }} aria-hidden>
      <StadiumArt {...props} all={all} />
    </svg>
  )
}

type MapProps = {
  map: VenueMap
  stock: StockBlock[]
  colorFor: (category: string) => string
  filter: string | null
  counts: Map<string, number>
  /** Block the map flies to (the one whose seat plan is open). */
  focusKey: string | null
  onSelect: (block: PublicSeatBlock) => void
  onOther: (text: string) => void
  labels: {
    floor: string
    ring: string
    zoomIn: string
    zoomOut: string
    reset: string
    legendOnSale: string
    legendSoldOut: string
    legendOther: string
    describe: (s: StockBlock) => string
    describeOther: (label: string) => string
  }
  disabled?: boolean
}

/** Interactive overview; fills its parent. */
export default function StadiumMap({ map, stock, colorFor, filter, counts, focusKey, onSelect, onOther, labels, disabled }: MapProps) {
  const all = useMemo(() => allBlocks(map), [map])
  const content = useMemo<Box>(() => ({ x: 0, y: 0, w: map.viewBox.w, h: map.viewBox.h }), [map])
  const pz = usePanZoom({ content, maxZoom: 6, pad: 0.02 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)

  // Fly onto the block whose seat plan opens; back out when it closes.
  const lastFocus = useRef<string | null>(null)
  const { focusBox, reset } = pz
  useEffect(() => {
    if (focusKey === lastFocus.current) return
    const had = lastFocus.current !== null
    lastFocus.current = focusKey
    const target = focusKey ? stock.find((s) => blockKey(s.block) === focusKey) : null
    if (target) focusBox({ x: target.shape.cx - 34, y: target.shape.cy - 26, w: 68, h: 52 })
    else if (had) reset()
  }, [focusKey, stock, focusBox, reset])

  const interaction: Interaction = {
    onSelect,
    onOther,
    onHover: (info) => {
      const rect = wrapRef.current?.getBoundingClientRect()
      setTip(info && rect ? { text: info.text, x: info.clientX - rect.left, y: info.clientY - rect.top } : null)
    },
    describe: labels.describe,
    describeOther: labels.describeOther,
    suppressClick: pz.suppressClick,
    disabled,
  }
  const zoomedIn = pz.zoom > 1.01

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <svg
        {...pz.svgProps}
        className={`h-full w-full select-none ${zoomedIn ? 'cursor-grab active:cursor-grabbing' : ''}`}
        role="group"
        aria-label={map.name}
        onPointerLeave={() => setTip(null)}
      >
        <StadiumArt
          map={map}
          all={all}
          stock={stock}
          colorFor={colorFor}
          filter={filter}
          activeKey={focusKey}
          counts={counts}
          labels={labels}
          interaction={interaction}
        />
      </svg>

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
        canOut={zoomedIn}
        labels={{ zoomIn: labels.zoomIn, zoomOut: labels.zoomOut, reset: labels.reset }}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-4.5rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-ink-950/70 px-2.5 py-1.5 text-[10px] text-white/60 backdrop-blur">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-gradient-to-r from-flame-500 via-amber-400 to-sky-400" aria-hidden /> {labels.legendOnSale}
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
