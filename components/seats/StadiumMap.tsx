'use client'

import { useMemo } from 'react'
import { freeInBlock } from '@/lib/seats/pick'
import type { FreeRun, PublicSeatBlock } from '@/lib/seats/types'
import {
  FLOOR,
  VIEWBOX,
  backgroundCells,
  placeBlock,
  type VenueMap,
} from '@/lib/seats/venueMaps'

// Simplified stadium map for seat sales (phase 43). The bowl is drawn faintly;
// the blocks AlbaGo has seats in are coloured by category, dimmed when sold
// out, and the block the buyer's seats come from glows. Tapping a block hands
// it to the panel, which picks the best seats inside it.

type Props = {
  map: VenueMap
  blocks: PublicSeatBlock[]
  runs: FreeRun[]
  colorFor: (category: string) => string
  /** Block whose seats are currently shown (tapped or best available). */
  activeKey: string | null
  onSelect: (block: PublicSeatBlock) => void
  labels: { floor: string; ring: string; blockFree: (block: string, free: number) => string }
  disabled?: boolean
}

export default function StadiumMap({
  map,
  blocks,
  runs,
  colorFor,
  activeKey,
  onSelect,
  labels,
  disabled,
}: Props) {
  const background = useMemo(() => backgroundCells(map), [map])
  const placed = useMemo(
    () =>
      blocks
        .map((b) => {
          const shape = placeBlock(map, b.area, b.block)
          return shape ? { block: b, shape, free: freeInBlock(runs, b) } : null
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [map, blocks, runs],
  )
  const stockFloor = new Set(
    placed.filter((p) => p.shape.rect).map((p) => p.shape.label),
  )
  const outer = Math.max(...map.tiers.map((t) => t.outer)) + 4
  const ringHalf = map.ring.size / 2

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      className="h-auto w-full select-none"
      role="group"
      aria-label={map.name}
    >
      {/* Bowl */}
      <rect
        x={FLOOR.x0 - outer}
        y={FLOOR.y0 - outer}
        width={FLOOR.x1 - FLOOR.x0 + outer * 2}
        height={FLOOR.y1 - FLOOR.y0 + outer * 2}
        rx={outer}
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.08)"
      />
      {background.map((cell) => (
        <path key={cell.key} d={cell.d} fill="rgba(255,255,255,0.045)" stroke="#08080c" strokeWidth={1.1} />
      ))}

      {/* Floor + ring */}
      <rect
        x={FLOOR.x0}
        y={FLOOR.y0}
        width={FLOOR.x1 - FLOOR.x0}
        height={FLOOR.y1 - FLOOR.y0}
        rx={5}
        fill="rgba(255,255,255,0.025)"
        stroke="rgba(255,255,255,0.08)"
      />
      {Object.entries(map.floorBlocks)
        .filter(([label]) => !stockFloor.has(label))
        .map(([label, r]) => (
          <rect key={label} x={r.x} y={r.y} width={r.w} height={r.h} rx={1.5} fill="rgba(255,255,255,0.05)" />
        ))}
      <rect
        x={map.ring.cx - ringHalf}
        y={map.ring.cy - ringHalf}
        width={map.ring.size}
        height={map.ring.size}
        fill="rgba(238,28,37,0.16)"
        stroke="#ee1c25"
        strokeWidth={1.2}
      />
      <rect
        x={map.ring.cx - ringHalf + 3}
        y={map.ring.cy - ringHalf + 3}
        width={map.ring.size - 6}
        height={map.ring.size - 6}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={0.5}
      />
      <text
        x={map.ring.cx}
        y={map.ring.cy + 2}
        textAnchor="middle"
        fontSize={5.5}
        fontWeight={700}
        letterSpacing={0.6}
        fill="rgba(255,255,255,0.8)"
      >
        {labels.ring.toUpperCase()}
      </text>
      <text
        x={(FLOOR.x0 + FLOOR.x1) / 2}
        y={FLOOR.y1 - 4}
        textAnchor="middle"
        fontSize={5.5}
        letterSpacing={1}
        fill="rgba(255,255,255,0.3)"
      >
        {labels.floor.toUpperCase()}
      </text>

      {/* Stand label */}
      <text
        x={FLOOR.x0 - outer - 9}
        y={(FLOOR.y0 + FLOOR.y1) / 2}
        textAnchor="middle"
        fontSize={7}
        fontWeight={700}
        letterSpacing={1.4}
        fill="rgba(255,255,255,0.45)"
        transform={`rotate(-90 ${FLOOR.x0 - outer - 9} ${(FLOOR.y0 + FLOOR.y1) / 2})`}
      >
        {map.leftStandLabel.toUpperCase()}
      </text>

      {/* Blocks with AlbaGo seats */}
      {placed.map(({ block, shape, free }) => {
        const color = colorFor(block.category)
        const active = shape.key === activeKey
        const soldOut = free <= 0
        const clickable = !soldOut && !disabled
        const fill = soldOut ? 'rgba(255,255,255,0.08)' : color
        const common = {
          fill,
          fillOpacity: soldOut ? 1 : active ? 1 : 0.55,
          stroke: active ? '#ffffff' : soldOut ? 'rgba(255,255,255,0.25)' : color,
          strokeWidth: active ? 1.6 : 1,
          strokeDasharray: soldOut ? '2 1.5' : undefined,
          style: active ? { filter: `drop-shadow(0 0 5px ${color})` } : undefined,
        }
        return (
          <g
            key={shape.key}
            role="button"
            tabIndex={clickable ? 0 : -1}
            aria-pressed={active}
            aria-disabled={!clickable}
            aria-label={labels.blockFree(shape.label, free)}
            onClick={() => clickable && onSelect(block)}
            onKeyDown={(e) => {
              if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onSelect(block)
              }
            }}
            className={clickable ? 'cursor-pointer outline-none' : 'cursor-not-allowed outline-none'}
          >
            {shape.d && <path d={shape.d} {...common} />}
            {shape.rect && (
              <rect x={shape.rect.x} y={shape.rect.y} width={shape.rect.w} height={shape.rect.h} rx={1.5} {...common} />
            )}
            <text
              x={shape.labelX}
              y={Math.round((shape.labelY + (shape.rect ? 1.8 : 2.4)) * 100) / 100}
              textAnchor="middle"
              fontSize={shape.rect ? 5 : 7}
              fontWeight={700}
              fill={soldOut ? 'rgba(255,255,255,0.4)' : '#ffffff'}
              pointerEvents="none"
            >
              {shape.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
