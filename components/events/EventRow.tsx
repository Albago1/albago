'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * One horizontal, swipeable line of cards (Netflix-style category row).
 * Phones swipe with snap; desktop gets arrow buttons that only appear when
 * there is more to scroll in that direction.
 */
export default function EventRow({
  children,
  labelledBy,
}: {
  children: ReactNode
  labelledBy?: string
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
    'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-ink-950/85 text-white shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition hover:border-white/30 hover:bg-ink-900 md:flex'

  return (
    <div className="group/row relative">
      <div
        ref={trackRef}
        role="list"
        aria-labelledby={labelledBy}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {canPrev && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollByPage(-1)}
          className={`${arrowClass} -left-5`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canNext && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollByPage(1)}
          className={`${arrowClass} -right-5`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
