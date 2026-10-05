'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Tracks whether a horizontal track can scroll further left / right. */
export function useScrollArrows(trackRef: RefObject<HTMLDivElement | null>, deps: unknown) {
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const update = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [trackRef])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    // Re-measure when the row, any card, or the window changes size — the
    // overflow can change without the row itself resizing.
    const observer = new ResizeObserver(() => update())
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [trackRef, update, deps])

  const scrollByPage = (direction: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return { canPrev, canNext, scrollByPage }
}

/** Prev / next buttons for a header row. Hidden entirely when everything
 *  already fits, so a full row never shows dead arrows. */
export function RailArrows({
  canPrev,
  canNext,
  scrollByPage,
}: ReturnType<typeof useScrollArrows>) {
  if (!canPrev && !canNext) return null
  const arrowClass =
    'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white transition hover:bg-white/[0.1] disabled:pointer-events-none disabled:opacity-30'
  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        aria-label="Scroll left"
        disabled={!canPrev}
        onClick={() => scrollByPage(-1)}
        className={arrowClass}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Scroll right"
        disabled={!canNext}
        onClick={() => scrollByPage(1)}
        className={arrowClass}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}

/** Snap-scrolling track. Extra top/bottom padding leaves room for the card
 *  hover lift and the poster glow, which overflow clipping would cut off. */
export const RAIL_TRACK_CLASS =
  '-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-8 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

/**
 * One horizontal, swipeable line of cards (Netflix-style category row). The
 * prev/next arrows sit at the right of the heading row, clear of the posters;
 * touch devices can also swipe (with snap).
 */
export default function EventRow({
  heading,
  labelledBy,
  children,
}: {
  heading: ReactNode
  labelledBy?: string
  children: ReactNode
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const arrows = useScrollArrows(trackRef, children)

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">{heading}</div>
        <RailArrows {...arrows} />
      </div>

      <div ref={trackRef} role="list" aria-labelledby={labelledBy} className={RAIL_TRACK_CLASS}>
        {children}
      </div>
    </div>
  )
}
