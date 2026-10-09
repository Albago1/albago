'use client'

import { useMemo } from 'react'
import { StadiumPreview, type StockBlock } from '@/components/seats/StadiumMap'
import { allBlocks, venueMapById, type Side } from '@/lib/seats/venueMaps'
import { CATEGORIES } from '@/lib/hysa/event'

// AlbaGo's own stadium drawing with the Nord-Tribüne (the stand the Hysa
// channel's tickets are in) highlighted by tier. Orientation only — the
// official live seat map stays the source of truth.

const NORTH_STAND: Side[] = ['L', 'TL', 'BL']

export default function HysaStadium({ labels }: { labels: { floor: string; ring: string } }) {
  const map = venueMapById('merkur-spiel-arena-boxing')!
  const stock = useMemo<StockBlock[]>(
    () =>
      allBlocks(map)
        .filter((b) => b.tier >= 0 && b.side && NORTH_STAND.includes(b.side))
        .map((shape) => ({
          block: { category: shape.tier === 0 ? 'cat6' : 'cat8', area: 'Nord-Tribüne', block: shape.label ?? '' },
          shape,
          free: 1,
        })),
    [map],
  )
  const colorFor = useMemo(() => {
    const colors = new Map(CATEGORIES.map((c) => [c.id, c.color]))
    return (category: string) => colors.get(category as (typeof CATEGORIES)[number]['id']) ?? '#ffffff'
  }, [])
  return <StadiumPreview map={map} stock={stock} colorFor={colorFor} labels={labels} />
}
