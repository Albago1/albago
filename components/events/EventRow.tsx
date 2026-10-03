'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * One horizontal, swipeable line of cards (Netflix-style category row).
 * The heading sits on the left with left/right arrows on the right, on every
 * screen size; an arrow dims when there is nothing more to scroll that way.
 * Touch devices can also swipe (with snap).
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
    const observer = new ResizeObserver(() => updateArrows())
    observer.observe(el)
    el.addEventListener('scroll', updateArrows, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', updateArrows)
    }
  }, [updateArrows])

  const scrollByPage = (direction: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  const arrowClass =
    'flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-default disabled:border-white/[0.06] disabled:bg-transparent disabled:text-white/20 enabled:border-white/15 enabled:bg-white/[0.05] enabled:text-white enabled:hover:border-white/30 enabled:hover:bg-white/[0.12]'

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        {heading}
        <div className="flex shrink-0 items-center gap-2">
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
      </div>

      <div
        ref={trackRef}
        role="list"
        aria-labelledby={labelledBy}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  )
}
