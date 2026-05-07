'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Clock3, Music2, Banknote } from 'lucide-react'
import { Event } from '@/types/event'
import { Place } from '@/types/place'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { getTodayDateString } from '@/lib/dateFilters'

type PlacePanelProps = {
  place: Place | null
  events: Event[]
  isMobile: boolean
  onClose: () => void
}

const CLOSE_DRAG_THRESHOLD = 120

function sortEvents(events: Event[]) {
  return [...events].sort((a, b) => {
    if (Boolean(a.highlight) !== Boolean(b.highlight)) {
      return a.highlight ? -1 : 1
    }

    const aDateTime = new Date(`${a.date}T${a.time}`)
    const bDateTime = new Date(`${b.date}T${b.time}`)

    return aDateTime.getTime() - bDateTime.getTime()
  })
}

export default function PlacePanel({
  place,
  events,
  isMobile,
  onClose,
}: PlacePanelProps) {
  const { t, language } = useLanguage()
  const [dragStartY, setDragStartY] = useState<number | null>(null)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const safeEvents = Array.isArray(events) ? events : []
  const sortedEvents = useMemo(() => sortEvents(safeEvents), [safeEvents])
  const highlightedEventsCount = sortedEvents.filter((event) => event.highlight).length

  useEffect(() => {
    setDragStartY(null)
    setDragOffsetY(0)
    setIsDragging(false)
  }, [place])

  if (!place) return null

  const formatEventDateLabel = (dateString: string) => {
    const eventDate = new Date(`${dateString}T12:00:00`)
    const today = new Date(`${getTodayDateString()}T12:00:00`)

    const diffInMs = eventDate.getTime() - today.getTime()
    const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) return t('tonight')
    if (diffInDays === 1) return t('tomorrow')

    const localeMap = {
      en: 'en-GB',
      de: 'de-DE',
      es: 'es-ES',
      al: 'sq-AL',
    } as const

    return eventDate.toLocaleDateString(localeMap[language], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return
    setDragStartY(event.touches[0].clientY)
    setIsDragging(true)
  }

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || dragStartY === null) return
    const currentY = event.touches[0].clientY
    setDragOffsetY(Math.max(0, currentY - dragStartY))
  }

  const handleTouchEnd = () => {
    if (!isMobile) return

    if (dragOffsetY >= CLOSE_DRAG_THRESHOLD) {
      onClose()
      return
    }

    setDragStartY(null)
    setDragOffsetY(0)
    setIsDragging(false)
  }

  return (
    <aside
      className={[
        'z-30 overflow-hidden border border-white/10 bg-[#070b14]/94 text-white shadow-2xl backdrop-blur-xl',
        isMobile
          ? 'absolute inset-x-0 bottom-0 h-[76vh] rounded-t-[32px]'
          : 'absolute right-4 top-4 h-[calc(100vh-2rem)] w-[390px] rounded-[32px]',
      ].join(' ')}
      style={
        isMobile
          ? {
              transform: `translateY(${dragOffsetY}px)`,
              transition: isDragging ? 'none' : 'transform 200ms ease',
            }
          : undefined
      }
    >
      {isMobile && (
        <div
          className="cursor-grab touch-none px-5 pb-2 pt-3"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex justify-center">
            <div className="h-1.5 w-12 rounded-full bg-white/20" />
          </div>
        </div>
      )}

      <div className="flex h-full min-h-0 flex-col">
        <div className="relative">
          {place.imageUrl ? (
            <div
              className={isMobile ? 'h-44 bg-cover bg-center' : 'h-52 bg-cover bg-center'}
              style={{ backgroundImage: `url(${place.imageUrl})` }}
            />
          ) : (
            <div className={isMobile ? 'h-36 bg-gradient-to-br from-blue-600/25 to-violet-600/20' : 'h-44 bg-gradient-to-br from-blue-600/25 to-violet-600/20'} />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/45 to-transparent" />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="absolute bottom-4 left-5 right-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold capitalize text-white/80 backdrop-blur">
                {place.category}
              </span>

              {highlightedEventsCount > 0 && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black">
                  {highlightedEventsCount} HOT
                </span>
              )}
            </div>

            <h2 className="mt-3 text-2xl font-bold leading-tight text-white">
              {place.name}
            </h2>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5">
          {place.options.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {place.options.map((option) => (
                <span
                  key={option}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70"
                >
                  {option}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                {t('upcoming_events')}
              </h3>

              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white">
                {sortedEvents.length}{' '}
                {sortedEvents.length === 1 ? t('event_singular') : t('event_plural')}
              </span>
            </div>

            <div className="space-y-3">
              {sortedEvents.length > 0 ? (
                sortedEvents.map((event) => (
                  <div
                    key={event.id}
                    className={[
                      'rounded-2xl border p-4 backdrop-blur-md transition hover:bg-white/[0.06]',
                      event.highlight
                        ? 'border-white/15 bg-white/[0.06] shadow-[0_0_24px_rgba(255,255,255,0.04)]'
                        : 'border-white/10 bg-white/[0.035]',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-semibold leading-snug text-white">
                        {event.title}
                      </p>

                      <div className="flex shrink-0 items-center gap-2">
                        {event.highlight && (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                            {t('hot')}
                          </span>
                        )}

                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-white/70">
                          {formatEventDateLabel(event.date)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        <Clock3 className="h-3.5 w-3.5" /> {event.time}
                      </span>

                      {event.category && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                          <Music2 className="h-3.5 w-3.5" /> {event.category}
                        </span>
                      )}

                      {event.price && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                          <Banknote className="h-3.5 w-3.5" /> {event.price}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-sm leading-6 text-white/68">
                      {event.description}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
                  <p className="text-sm font-medium text-white">
                    {t('no_upcoming_events')}
                  </p>
                  <p className="mt-1 text-sm text-white/55">
                    {t('no_upcoming_events_hint')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              {t('about_this_place')}
            </h3>

            <p className="text-sm leading-6 text-white/68">{place.description}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}