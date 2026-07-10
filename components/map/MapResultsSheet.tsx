'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronUp, MapPin, Tag, X } from 'lucide-react'
import { CATEGORY_ICONS } from '@/components/events/categoryMeta'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

export type SheetEventRow = {
  id: string
  title: string
  sub: string
  category: string
}

export type SheetPlaceRow = {
  id: string
  name: string
  sub: string
}

type MapResultsSheetProps = {
  events: SheetEventRow[]
  places: SheetPlaceRow[]
  hidden: boolean
  onPickEvent: (id: string) => void
  onPickPlace: (id: string) => void
}

// Google-Maps-style mobile results sheet: a collapsed count pill floating
// above the bottom nav that expands into a scrollable list of everything
// currently on the map. Picking a row selects its pin and collapses back.
export default function MapResultsSheet({
  events,
  places,
  hidden,
  onPickEvent,
  onPickPlace,
}: MapResultsSheetProps) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)

  const total = events.length + places.length
  if (hidden || total === 0) {
    return null
  }

  const countLabel = `${total} ${total === 1 ? t('map_result') : t('map_results')}`

  const pickEvent = (id: string) => {
    setExpanded(false)
    onPickEvent(id)
  }

  const pickPlace = (id: string) => {
    setExpanded(false)
    onPickPlace(id)
  }

  return (
    <div className="md:hidden">
      {!expanded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[4.75rem] z-20 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-ink-950/90 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <ChevronUp className="h-4 w-4 text-white/60" />
            {countLabel}
          </button>
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-black/45"
              onClick={() => setExpanded(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="absolute inset-x-0 bottom-0 z-40 max-h-[68%] overflow-hidden rounded-t-[28px] border-t border-white/10 bg-ink-950/95 shadow-[0_-20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            >
              <div className="flex flex-col" style={{ maxHeight: 'inherit' }}>
                <button
                  type="button"
                  aria-label="Collapse"
                  onClick={() => setExpanded(false)}
                  className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-white/15"
                />

                <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">{t('map_live_results')}</h2>
                    <p className="text-xs text-white/45">{countLabel}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setExpanded(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-[calc(4.75rem+env(safe-area-inset-bottom))] pt-1">
                  {events.map((event) => {
                    const Icon = CATEGORY_ICONS[event.category] ?? Tag
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => pickEvent(event.id)}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:bg-white/[0.06]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-flame-300">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white">
                            {event.title}
                          </span>
                          <span className="block truncate text-xs text-white/45">{event.sub}</span>
                        </span>
                      </button>
                    )
                  })}

                  {places.map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => pickPlace(place.id)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:bg-white/[0.06]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70">
                        <MapPin className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                          {place.name}
                        </span>
                        <span className="block truncate text-xs text-white/45">{place.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
