'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type Props = {
  urls: string[]
  alt: string
}

export default function EventGallery({ urls, alt }: Props) {
  const photos = urls.filter(Boolean)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const isOpen = activeIndex !== null

  const close = useCallback(() => setActiveIndex(null), [])

  const next = useCallback(() => {
    setActiveIndex((current) => {
      if (current === null) return current
      return (current + 1) % photos.length
    })
  }, [photos.length])

  const prev = useCallback(() => {
    setActiveIndex((current) => {
      if (current === null) return current
      return (current - 1 + photos.length) % photos.length
    })
  }, [photos.length])

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

  if (photos.length === 0) return null

  const hero = photos[0]
  const thumbs = photos.slice(1)

  return (
    <>
      <div className="mt-10 space-y-3">
        <button
          type="button"
          onClick={() => setActiveIndex(0)}
          className="group relative block aspect-[16/9] w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
          aria-label={`Open ${alt} in fullscreen`}
        >
          <Image
            src={hero}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            priority
            className="cursor-zoom-in object-cover transition group-hover:opacity-95"
          />
        </button>

        {thumbs.length > 0 && (
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {thumbs.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setActiveIndex(i + 1)}
                className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
                aria-label={`Open photo ${i + 2} in fullscreen`}
              >
                <Image
                  src={url}
                  alt={`${alt} — photo ${i + 2}`}
                  fill
                  sizes="(max-width: 768px) 25vw, 180px"
                  className="cursor-zoom-in object-cover transition hover:opacity-90"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
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
      )}
    </>
  )
}
