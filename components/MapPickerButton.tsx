'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Flame, Globe, ChevronDown, ExternalLink } from 'lucide-react'

type Props = {
  /** Internal AlbaGo map href, built from buildMapHref(). */
  albagoHref: string
  /** Latitude (preferred) for the Google Maps query. */
  lat?: number | null
  /** Longitude (preferred) for the Google Maps query. */
  lng?: number | null
  /** Fallback text used for the Google Maps search if lat/lng are absent. */
  address?: string | null
  /** "primary" = flame CTA, "secondary" = bordered chip. Defaults to primary. */
  variant?: 'primary' | 'secondary'
  /** Override the label on the button. Defaults to "Open in Map". */
  label?: string
}

function buildGoogleMapsHref(
  lat: number | null | undefined,
  lng: number | null | undefined,
  address: string | null | undefined,
): string | null {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }
  if (address && address.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
  }
  return null
}

export default function MapPickerButton({
  albagoHref,
  lat,
  lng,
  address,
  variant = 'primary',
  label = 'Open in Map',
}: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const googleMapsHref = buildGoogleMapsHref(lat, lng, address)

  useEffect(() => {
    if (!isOpen) return
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  const buttonClass =
    variant === 'primary'
      ? 'inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5'
      : 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.09] hover:text-white'

  const iconSize = variant === 'primary' ? 'h-4 w-4' : 'h-3.5 w-3.5'

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={buttonClass}
      >
        <MapPin className={iconSize} />
        {label}
        <ChevronDown
          className={`${iconSize} transition ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false)
              router.push(albagoHref)
            }}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-flame-500/30 bg-flame-500/10">
              <Flame className="h-3.5 w-3.5 text-flame-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">AlbaGo map</p>
              <p className="mt-0.5 text-xs text-white/55">
                See nearby events and venues.
              </p>
            </div>
          </button>

          {googleMapsHref && (
            <a
              role="menuitem"
              href={googleMapsHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Globe className="h-3.5 w-3.5 text-white/75" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                  Google Maps
                  <ExternalLink className="h-3 w-3 text-white/45" />
                </p>
                <p className="mt-0.5 text-xs text-white/55">
                  Open the location in Google Maps.
                </p>
              </div>
            </a>
          )}
        </div>
      )}
    </div>
  )
}
