'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * One horizontal, swipeable line of cards (Netflix-style category row).
 * Left/right arrows sit on the sides of the row, vertically centred on the
 * cards, on every screen size; an arrow dims when there is nothing more to
 * scroll that way. Touch devices can also swipe (with snap).
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
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const updateArrows = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    // Re-measure when the row, any card, or the window changes size — the
    // overflow can change without the row itself resizing.
    const observer = new ResizeObserver(() => updateArrows())
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows, children])

  const scrollByPage = (direction: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  const arrowClass =
    'absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-ink-950/85 text-white shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md transition hover:border-white/30 hover:bg-ink-900 disabled:pointer-events-none disabled:opacity-30'

  return (
    <div>
      <div className="mb-5">{heading}</div>

      <div className="relative">
        <div
          ref={trackRef}
          role="list"
          aria-labelledby={labelledBy}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>

        <button
          type="button"
          aria-label="Scroll left"
          disabled={!canPrev}
          onClick={() => scrollByPage(-1)}
          className={`${arrowClass} left-1 md:-left-5`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          disabled={!canNext}
          onClick={() => scrollByPage(1)}
          className={`${arrowClass} right-1 md:-right-5`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
