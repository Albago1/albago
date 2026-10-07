'use client'

import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { blockKey, freeInBlock, seatKeyOf } from '@/lib/seats/pick'
import { layoutBlock, type BlockLayout } from '@/lib/seats/seatLayout'
import type { FreeRun, PublicSeat, PublicSeatBlock } from '@/lib/seats/types'
import { allBlocks, findBlock, type MapBlock, type VenueMap } from '@/lib/seats/venueMaps'
import { usePanZoom, type Box } from './usePanZoom'

// Stadium map for seat sales (phase 43) — one continuous map, the way the big
// ticket shops do it. Zoomed out it shows every block, AlbaGo's coloured by
// price category; zoom in (pinch, wheel, buttons, or tap a block to fly in)
// and the blocks fill with their seats right where they are: AlbaGo's seats
// coloured and tappable, every other seat grey.
//   <StadiumMap>      the interactive map; fills its box
//   <StadiumPreview>  static picture (event-page card, mini-map)

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

// Zoom levels, in screen pixels per map unit.
const SEAT_PPU = 5 // seats start to show inside the blocks
const TAP_PPU = 11 // AlbaGo's seats can be tapped; tapping a block no longer flies
const FLY_PPU = 22 // where tapping a block (or "best seats") takes you
const NUMBER_PPU = 40 // seat numbers inside AlbaGo's seats
const MAX_PPU = 60

// Seat layouts of blocks without AlbaGo seats never change: compute once.
const emptyLayouts = new WeakMap<MapBlock, BlockLayout>()
function emptyLayout(map: VenueMap, block: MapBlock): BlockLayout {
  let layout = emptyLayouts.get(block)
  if (!layout) {
    layout = layoutBlock(map, block, [])
    emptyLayouts.set(block, layout)
  }
  return layout
}

type Hover = { text: string; clientX: number; clientY: number } | null

type Interaction = {
  onBlock: (s: StockBlock) => void
  onOther: (text: string) => void
  onHover: (info: Hover) => void
  describe: (s: StockBlock) => string
  describeOther: (label: string) => string
  suppressClick: RefObject<boolean>
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
  /** Zoomed in far enough that blocks show their seats. */
  seatLevel?: boolean
  /** Block-number size at seat level (map units). */
  labelSize?: number
  disabled?: boolean
}

/** The stadium drawing: field, ring and every block, in map units. */
export const StadiumArt = memo(function StadiumArt({
  map,
  all,
  stock,
  colorFor,
  filter,
  activeKey,
  counts,
  labels,
  mini,
  interaction,
  seatLevel,
  labelSize = 3,
  disabled,
}: ArtProps) {
  const stockShapes = new Set(stock.map((s) => s.shape))
  const ringHalf = map.ring.size / 2
  const { field } = map
  const hover = (text: string) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') interaction?.onHover({ text, clientX: e.clientX, clientY: e.clientY })
  }
  const unhover = () => interaction?.onHover(null)
  const seatLabel = (x: number, y: number, text: string, fill: string) => (
    <text
      x={x}
      y={y + labelSize * 0.35}
      textAnchor="middle"
      fontSize={labelSize}
      fontWeight={800}
      fill={fill}
      stroke="#050505"
      strokeWidth={labelSize * 0.28}
      paintOrder="stroke"
      pointerEvents="none"
    >
      {text}
    </text>
  )

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
      {!mini && !seatLevel && (
        <text x={(field.x0 + field.x1) / 2} y={field.y1 - 4} textAnchor="middle" fontSize={5} letterSpacing={1} fill="rgba(255,255,255,0.3)" pointerEvents="none">
          {labels.floor.toUpperCase()}
        </text>
      )}

      {/* Every block of the venue */}
      {all.map((b, i) => {
        if (stockShapes.has(b)) return null
        const common = seatLevel
          ? { fill: 'rgba(255,255,255,0.02)', stroke: 'rgba(255,255,255,0.12)', strokeWidth: 0.12 }
          : { fill: b.tier === -1 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.05)', stroke: '#050505', strokeWidth: 0.9 }
        // Zoomed out, a grey block says "not sold here" on tap / hover; zoomed
        // in, the chip at the top does that and taps belong to the seats.
        const text = b.label && interaction && !seatLevel ? interaction.describeOther(b.label) : null
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
            {b.rect && <rect x={b.rect.x} y={b.rect.y} width={b.rect.w} height={b.rect.h} rx={seatLevel ? 0.4 : 1} {...common} />}
            {b.label &&
              !mini &&
              (seatLevel ? (
                seatLabel(b.cx, b.cy, b.label, 'rgba(255,255,255,0.4)')
              ) : (
                <text x={b.cx} y={b.cy + (b.rect ? 1.5 : 2)} textAnchor="middle" fontSize={b.rect ? 3.8 : 5.6} fill="rgba(255,255,255,0.3)" pointerEvents="none">
                  {b.label}
                </text>
              ))}
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

      {!mini && !seatLevel && (
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
        const clickable = !!interaction && !soldOut && !disabled
        const count = counts?.get(key) ?? 0
        const common = seatLevel
          ? {
              fill: color,
              fillOpacity: dimmed ? 0.03 : 0.1,
              stroke: color,
              strokeOpacity: dimmed ? 0.3 : 0.85,
              strokeWidth: 0.14,
            }
          : {
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
            role={interaction && !seatLevel ? 'button' : undefined}
            tabIndex={clickable && !seatLevel ? 0 : undefined}
            aria-label={interaction && !seatLevel ? text : undefined}
            aria-disabled={interaction && !seatLevel ? !clickable : undefined}
            onClick={
              interaction
                ? () => {
                    if (interaction.suppressClick.current || !clickable) return
                    interaction.onBlock(s)
                  }
                : undefined
            }
            onKeyDown={
              clickable && !seatLevel
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      interaction!.onBlock(s)
                    }
                  }
                : undefined
            }
            onPointerEnter={interaction && !seatLevel ? hover(text) : undefined}
            onPointerLeave={interaction && !seatLevel ? unhover : undefined}
            pointerEvents={interaction ? undefined : 'none'}
            className={clickable ? 'cursor-pointer outline-none' : 'outline-none'}
          >
            {shape.d && <path d={shape.d} {...common} />}
            {shape.rect && <rect x={shape.rect.x} y={shape.rect.y} width={shape.rect.w} height={shape.rect.h} rx={seatLevel ? 0.4 : 1} {...common} />}
            {!mini &&
              (seatLevel ? (
                seatLabel(shape.cx, shape.cy, shape.label ?? block.block, '#ffffff')
              ) : (
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
              ))}
            {count > 0 && !mini && !seatLevel && (
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
})

/** Grey seats of the blocks in view (blocks without AlbaGo seats). */
const SeatTexture = memo(function SeatTexture({ map, blocks }: { map: VenueMap; blocks: MapBlock[] }) {
  return (
    <g pointerEvents="none" fill="rgba(255,255,255,0.13)">
      {blocks.map((b, i) => (
        <path key={`${b.tier}-${b.label ?? i}-${b.cx}`} d={emptyLayout(map, b).others} />
      ))}
    </g>
  )
})

type Laid = { stock: StockBlock; layout: BlockLayout }

/** AlbaGo's blocks at seat level: grey neighbours, row numbers, our seats. */
const OurSeats = memo(function OurSeats({
  laid,
  colorFor,
  picked,
  tappable,
  numbers,
  onSeat,
  onFly,
  onHover,
  describeSeat,
  suppressClick,
  disabled,
}: {
  laid: Laid[]
  colorFor: (category: string) => string
  picked: Set<string>
  tappable: boolean
  numbers: boolean
  onSeat: (seat: PublicSeat) => void
  onFly: (s: StockBlock) => void
  onHover: (info: Hover) => void
  describeSeat: (seat: PublicSeat, n: number) => string
  suppressClick: RefObject<boolean>
  disabled?: boolean
}) {
  return (
    <g>
      {laid.map(({ stock, layout }) => {
        const color = colorFor(stock.block.category)
        const r = layout.radius
        const hit = r * 1.55
        return (
          <g key={blockKey(stock.block)}>
            <path d={layout.others} fill="rgba(255,255,255,0.13)" pointerEvents="none" />
            {tappable &&
              layout.rowLabels.map((l, i) => (
                <text
                  key={i}
                  x={l.x}
                  y={l.y + layout.labelSize * 0.35}
                  textAnchor="middle"
                  fontSize={layout.labelSize}
                  fontWeight={700}
                  fill="rgba(255,255,255,0.45)"
                  pointerEvents="none"
                >
                  {l.label}
                </text>
              ))}
            {layout.seats.map(({ n, x, y, seat }) => {
              if (!seat) return null
              const key = seatKeyOf(seat)
              const isPicked = picked.has(key)
              const canTap = seat.free && !disabled
              const label = describeSeat(seat, n)
              return (
                <g
                  key={key}
                  role={tappable ? 'button' : undefined}
                  tabIndex={tappable && canTap ? 0 : undefined}
                  aria-pressed={tappable ? isPicked : undefined}
                  aria-disabled={tappable ? !canTap : undefined}
                  aria-label={tappable ? label : undefined}
                  className={canTap ? 'cursor-pointer outline-none' : 'cursor-not-allowed outline-none'}
                  onClick={() => {
                    if (suppressClick.current) return
                    if (!tappable) onFly(stock)
                    else if (canTap) onSeat(seat)
                  }}
                  onKeyDown={(e) => {
                    if (tappable && canTap && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      onSeat(seat)
                    }
                  }}
                  onPointerEnter={(e) => {
                    if (tappable && e.pointerType === 'mouse') onHover({ text: label, clientX: e.clientX, clientY: e.clientY })
                  }}
                  onPointerLeave={() => onHover(null)}
                >
                  <circle cx={x} cy={y} r={hit} fill="transparent" />
                  {isPicked && <circle cx={x} cy={y} r={r * 1.4} fill="none" stroke={color} strokeWidth={r * 0.28} />}
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill={isPicked ? '#ffffff' : seat.free ? color : 'rgba(255,255,255,0.08)'}
                    stroke={seat.free ? (isPicked ? '#ffffff' : 'rgba(255,255,255,0.6)') : 'rgba(255,255,255,0.3)'}
                    strokeWidth={r * 0.14}
                  />
                  {isPicked ? (
                    <path
                      d={`M${x - r * 0.45} ${y + r * 0.02} l${r * 0.3} ${r * 0.32} l${r * 0.6} ${-r * 0.68}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={r * 0.26}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : !seat.free ? (
                    <path
                      d={`M${x - r * 0.45} ${y - r * 0.45} l${r * 0.9} ${r * 0.9} M${x + r * 0.45} ${y - r * 0.45} l${-r * 0.9} ${r * 0.9}`}
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth={r * 0.16}
                    />
                  ) : numbers ? (
                    <text x={x} y={y + r * 0.36} textAnchor="middle" fontSize={r * 1.0} fontWeight={800} fill="#ffffff" pointerEvents="none">
                      {n}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </g>
        )
      })}
    </g>
  )
})

type PreviewProps = Omit<ArtProps, 'all' | 'interaction' | 'seatLevel' | 'labelSize'> & { className?: string }

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

export type MapLabels = {
  floor: string
  ring: string
  zoomIn: string
  zoomOut: string
  reset: string
  legendOnSale: string
  legendSoldOut: string
  legendOther: string
  legendFree: string
  legendPicked: string
  legendTaken: string
  legendNotOnSale: string
  block: string
  describe: (s: StockBlock) => string
  describeOther: (label: string) => string
  describeSeat: (seat: PublicSeat, n: number) => string
}

type MapProps = {
  map: VenueMap
  stock: StockBlock[]
  seats: PublicSeat[]
  colorFor: (category: string) => string
  filter: string | null
  picked: Set<string>
  counts: Map<string, number>
  /** Ask the map to fly to these seats (new id = new flight). */
  fly: { id: number; keys: string[] } | null
  onToggleSeat: (seat: PublicSeat) => void
  onOther: (text: string) => void
  /** AlbaGo block the zoomed-in view is on (null when zoomed out / elsewhere). */
  onViewBlock: (key: string | null) => void
  labels: MapLabels
  disabled?: boolean
}

/** Interactive map; fills its parent. */
export default function StadiumMap({
  map,
  stock,
  seats,
  colorFor,
  filter,
  picked,
  counts,
  fly,
  onToggleSeat,
  onOther,
  onViewBlock,
  labels,
  disabled,
}: MapProps) {
  const all = useMemo(() => allBlocks(map), [map])
  const content = useMemo<Box>(() => ({ x: 0, y: 0, w: map.viewBox.w, h: map.viewBox.h }), [map])
  const pz = usePanZoom({ content, maxZoom: 40, maxPxPerUnit: MAX_PPU, pad: 0.02 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)

  // Latest callbacks, so the memoised layers never need new props for them.
  const cb = useRef({ onToggleSeat, onOther, onViewBlock, labels })
  useEffect(() => {
    cb.current = { onToggleSeat, onOther, onViewBlock, labels }
  })

  const laid = useMemo<Laid[]>(
    () =>
      stock.map((s) => ({
        stock: s,
        layout: layoutBlock(
          map,
          s.shape,
          seats.filter((x) => x.area === s.block.area && x.block === s.block.block),
        ),
      })),
    [map, stock, seats],
  )
  const stockShapes = useMemo(() => new Set(stock.map((s) => s.shape)), [stock])

  const { view, pxPerUnit: ppu, flyTo, reset, suppressClick } = pz
  const seatLevel = ppu >= SEAT_PPU
  const tappable = ppu >= TAP_PPU
  const numbers = ppu >= NUMBER_PPU
  // Block numbers stay ~13px on screen; the size moves in √2 steps so the
  // drawing only re-renders when a step changes.
  const step = ppu > 0 ? Math.pow(2, Math.round(Math.log2(ppu) * 2) / 2) : 1
  const labelSize = Math.round((13 / step) * 1000) / 1000

  // Blocks in view (with a margin), for the grey seat texture.
  const margin = view.w * 0.15
  const inView = (b: MapBlock) =>
    b.box.x1 >= view.x - margin && b.box.x0 <= view.x + view.w + margin && b.box.y1 >= view.y - margin && b.box.y0 <= view.y + view.h + margin
  const visibleKey = seatLevel ? all.map((b, i) => (!stockShapes.has(b) && inView(b) ? i : -1)).filter((i) => i >= 0).join(',') : ''
  const visible = useMemo(() => (visibleKey ? visibleKey.split(',').map((i) => all[Number(i)]) : []), [visibleKey, all])

  // The block in the middle of the view — shown as a chip when zoomed in.
  const cx = view.x + view.w / 2
  const cy = view.y + view.h / 2
  const centre = seatLevel
    ? all.reduce<MapBlock | null>(
        (best, b) => (!best || Math.hypot(b.cx - cx, b.cy - cy) < Math.hypot(best.cx - cx, best.cy - cy) ? b : best),
        null,
      )
    : null
  const centreStock = centre ? (stock.find((s) => s.shape === centre) ?? null) : null
  const centreKey = centreStock ? blockKey(centreStock.block) : null
  useEffect(() => {
    cb.current.onViewBlock(centreKey)
  }, [centreKey])

  // Fly to seats on request (best seats, a seat in the basket).
  useEffect(() => {
    if (!fly || !fly.keys.length) return
    const want = new Set(fly.keys)
    const pts = laid.flatMap(({ layout }) => layout.seats.filter((s) => s.seat && want.has(seatKeyOf(s.seat))))
    if (!pts.length) return
    flyTo(pts.reduce((t, p) => t + p.x, 0) / pts.length, pts.reduce((t, p) => t + p.y, 0) / pts.length, FLY_PPU)
    // Only a new request (id) flies; the layouts are stable per sale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fly?.id])

  const onHover = useMemo(
    () => (info: Hover) => {
      const rect = wrapRef.current?.getBoundingClientRect()
      setTip(info && rect ? { text: info.text, x: info.clientX - rect.left, y: info.clientY - rect.top } : null)
    },
    [],
  )
  const onFly = useMemo(
    () => (s: StockBlock) => {
      const l = laid.find((x) => x.stock === s)?.layout
      flyTo(l ? l.focus.x : s.shape.cx, l ? l.focus.y : s.shape.cy, FLY_PPU)
    },
    [laid, flyTo],
  )
  const interaction = useMemo<Interaction>(
    () => ({
      onBlock: (s) => onFly(s),
      onOther: (text) => cb.current.onOther(text),
      onHover,
      describe: (s) => cb.current.labels.describe(s),
      describeOther: (label) => cb.current.labels.describeOther(label),
      suppressClick,
    }),
    [onFly, onHover, suppressClick],
  )
  const onSeat = useMemo(() => (seat: PublicSeat) => cb.current.onToggleSeat(seat), [])
  const describeSeat = useMemo(() => (seat: PublicSeat, n: number) => cb.current.labels.describeSeat(seat, n), [])
  const artLabels = useMemo(() => ({ floor: labels.floor, ring: labels.ring }), [labels.floor, labels.ring])

  const zoomedIn = pz.zoom > 1.01
  const { w: W, h: H } = map.viewBox
  const centreText = centre
    ? centreStock
      ? labels.describe(centreStock)
      : centre.label
        ? labels.describeOther(centre.label)
        : null
    : null

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
          counts={counts}
          labels={artLabels}
          interaction={interaction}
          seatLevel={seatLevel}
          labelSize={labelSize}
          disabled={disabled || tappable}
        />
        {seatLevel && <SeatTexture map={map} blocks={visible} />}
        {seatLevel && (
          <OurSeats
            laid={laid}
            colorFor={colorFor}
            picked={picked}
            tappable={tappable}
            numbers={numbers}
            onSeat={onSeat}
            onFly={onFly}
            onHover={onHover}
            describeSeat={describeSeat}
            suppressClick={suppressClick}
            disabled={disabled}
          />
        )}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-lg border border-white/15 bg-ink-950/95 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xl"
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </div>
      )}

      {/* Where you are, once zoomed in */}
      {centreText && (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-9.5rem)]">
          <span className="inline-flex max-w-full items-center gap-2 truncate rounded-full border border-white/15 bg-ink-950/85 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur">
            {centreStock && (
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: colorFor(centreStock.block.category) }} aria-hidden />
            )}
            <span className="truncate">{centreText}</span>
          </span>
        </div>
      )}

      {/* Mini-map with the view box; tap to see the whole stadium */}
      {seatLevel && (
        <button
          type="button"
          onClick={reset}
          aria-label={labels.reset}
          className="absolute right-3 top-3 w-[112px] rounded-xl border border-white/15 bg-ink-950/85 p-1.5 shadow-lg backdrop-blur transition hover:border-white/35 lg:w-[160px]"
        >
          <span className="relative block overflow-hidden">
            <StadiumPreview map={map} stock={stock} colorFor={colorFor} labels={artLabels} mini />
            <span
              className="absolute rounded-[3px] border-2 border-white bg-white/10"
              style={{
                left: `${Math.max(0, (view.x / W) * 100)}%`,
                top: `${Math.max(0, (view.y / H) * 100)}%`,
                width: `${Math.min(100, (view.w / W) * 100)}%`,
                height: `${Math.min(100, (view.h / H) * 100)}%`,
              }}
              aria-hidden
            />
          </span>
        </button>
      )}

      <ZoomControls
        onIn={() => pz.zoomBy(2)}
        onOut={() => pz.zoomBy(0.5)}
        onReset={reset}
        canOut={zoomedIn}
        labels={{ zoomIn: labels.zoomIn, zoomOut: labels.zoomOut, reset: labels.reset }}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-4.5rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-ink-950/75 px-2.5 py-1.5 text-[10px] text-white/60 backdrop-blur">
        {seatLevel ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-full bg-gradient-to-r from-flame-500 via-amber-400 to-sky-400" aria-hidden /> {labels.legendFree}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-flame-400 bg-white" aria-hidden /> {labels.legendPicked}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-white/30 bg-white/[0.08]" aria-hidden /> {labels.legendTaken}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/[0.13]" aria-hidden /> {labels.legendNotOnSale}
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-gradient-to-r from-flame-500 via-amber-400 to-sky-400" aria-hidden /> {labels.legendOnSale}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-white/40" aria-hidden /> {labels.legendSoldOut}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-white/10" aria-hidden /> {labels.legendOther}
            </span>
          </>
        )}
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
