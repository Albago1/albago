'use client'

import { useState } from 'react'
import Image from 'next/image'
import PhotoLightbox from './PhotoLightbox'

export type EventSection = {
  title: string
  body: string
  urls: string[]
}

type Props = {
  sections: EventSection[]
}

/**
 * Named photo sections on the public event page — each a heading + optional
 * blurb + its own photo grid, rendered as a band. Sections with no photos and
 * no text are filtered out. Clicking a photo opens the shared lightbox scoped
 * to that section's photos.
 */
export default function EventSections({ sections }: Props) {
  // Lightbox state is scoped per section: which section is open, and the index
  // within it. `null` = closed.
  const [open, setOpen] = useState<{ section: number; index: number } | null>(null)

  const clean = sections
    .map((s) => ({
      title: (s.title ?? '').trim(),
      body: (s.body ?? '').trim(),
      urls: (s.urls ?? []).filter(Boolean),
    }))
    .filter((s) => s.title || s.body || s.urls.length > 0)

  if (clean.length === 0) return null

  const activePhotos = open ? clean[open.section].urls : []

  return (
    <div className="mt-12 space-y-10">
      {clean.map((section, sIndex) => (
        <section key={sIndex}>
          {section.title && (
            <h2 className="display-text text-2xl leading-tight tracking-tight text-white sm:text-3xl">
              {section.title}
            </h2>
          )}
          {section.body && (
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/70">
              {section.body}
            </p>
          )}
          {section.urls.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {section.urls.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => setOpen({ section: sIndex, index: i })}
                  className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
                  aria-label={`Open ${section.title || 'section'} photo ${i + 1} in fullscreen`}
                >
                  <Image
                    src={url}
                    alt={`${section.title || 'Section'} — photo ${i + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 240px"
                    className="cursor-zoom-in object-cover transition hover:opacity-90"
                  />
                </button>
              ))}
            </div>
          )}
        </section>
      ))}

      <PhotoLightbox
        photos={activePhotos}
        activeIndex={open ? open.index : null}
        onChange={(index) =>
          setOpen((current) =>
            index === null || current === null
              ? null
              : { section: current.section, index },
          )
        }
        alt={open ? clean[open.section].title || 'Event photo' : 'Event photo'}
      />
    </div>
  )
}
