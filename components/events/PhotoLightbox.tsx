'use client'

import { useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type Props = {
  photos: string[]
  /** Index into `photos` currently shown, or null when the lightbox is closed. */
  activeIndex: number | null
  onChange: (index: number | null) => void
  alt: string
}

/**
 * Full-screen photo viewer shared by the main event gallery and the named
 * photo sections. Handles keyboard (Esc / ← / →), body-scroll lock, and
 * next/prev wrap-around. Renders nothing when closed.
 */
export default function PhotoLightbox({ photos, activeIndex, onChange, alt }: Props) {
  const isOpen = activeIndex !== null

  const close = useCallback(() => onChange(null), [onChange])

  const next = useCallback(() => {
    if (activeIndex === null || photos.length === 0) return
    onChange((activeIndex + 1) % photos.length)
  }, [activeIndex, photos.length, onChange])

  const prev = useCallback(() => {
    if (activeIndex === null || photos.length === 0) return
    onChange((activeIndex - 1 + photos.length) % photos.length)
  }, [activeIndex, photos.length, onChange])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, close, next, prev])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (activeIndex === null) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} — fullscreen`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 sm:p-10"
      onClick={close}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close fullscreen"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white transition hover:bg-white/[0.16] sm:right-6 sm:top-6"
      >
        <X className="h-5 w-5" />
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              prev()
            }}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white transition hover:bg-white/[0.16] sm:left-6"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              next()
            }}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white transition hover:bg-white/[0.16] sm:right-6"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div
        className="flex max-h-full max-w-full items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[activeIndex]}
          alt={alt}
          className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-[0_30px_120px_-20px_rgba(0,0,0,0.9)]"
        />
      </div>

      {photos.length > 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs text-white/70 sm:bottom-6">
          {activeIndex + 1} / {photos.length}
        </p>
      )}
    </div>
  )
}
