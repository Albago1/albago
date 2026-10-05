'use client'

import { useState } from 'react'
import Image from 'next/image'
import PhotoLightbox from './events/PhotoLightbox'

type Props = {
  urls: string[]
  alt: string
}

export default function EventGallery({ urls, alt }: Props) {
  // Photos whose host 404s are dropped instead of showing a broken image.
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const photos = urls.filter((url) => url && !failed.has(url))
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const markFailed = (url: string) =>
    setFailed((prev) => new Set(prev).add(url))

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
            unoptimized={!hero.includes('.supabase.co')}
            onError={() => markFailed(hero)}
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
                  unoptimized={!url.includes('.supabase.co')}
                  onError={() => markFailed(url)}
                  className="cursor-zoom-in object-cover transition hover:opacity-90"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <PhotoLightbox
        photos={photos}
        activeIndex={activeIndex}
        onChange={setActiveIndex}
        alt={alt}
      />
    </>
  )
}
