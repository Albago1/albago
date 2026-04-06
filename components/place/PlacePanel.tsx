'use client'

import { useEffect, useMemo, useState } from 'react'
import { Event } from '@/types/event'
import { Place } from '@/types/place'

type PlacePanelProps = {
  place: Place | null
  events: Event[]
  isMobile: boolean
  onClose: () => void
}

const TODAY = '2026-04-03'
const CLOSE_DRAG_THRESHOLD = 120

function formatEventDateLabel(dateString: string) {
  const eventDate = new Date(`${dateString}T12:00:00`)
  const today = new Date(`${TODAY}T12:00:00`)

  const diffInMs = eventDate.getTime() - today.getTime()
  const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInDays === 0) return 'Tonight'
  if (diffInDays === 1) return 'Tomorrow'

  return eventDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

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
  const [dragStartY, setDragStartY] = useState<number | null>(null)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const sortedEvents = useMemo(() => sortEvents(events), [events])

  useEffect(() => {
    setDragStartY(null)
    setDragOffsetY(0)
    setIsDragging(false)
  }, [place])

  if (!place) return null

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return

    setDragStartY(event.touches[0].clientY)
    setIsDragging(true)
  }

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || dragStartY === null) return

    const currentY = event.touches[0].clientY
    const nextOffset = Math.max(0, currentY - dragStartY)

    setDragOffsetY(nextOffset)
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
        'z-30 overflow-hidden bg-white shadow-2xl',
        isMobile
          ? 'absolute inset-x-0 bottom-0 h-[72vh] rounded-t-3xl'
          : 'absolute right-4 top-4 h-[calc(100vh-2rem)] w-[380px] rounded-2xl',
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
            <div className="h-1.5 w-12 rounded-full bg-gray-300" />
          </div>
        </div>
      )}

      {place.imageUrl && (
        <div
          className={
            isMobile
              ? 'h-44 w-full bg-cover bg-center'
              : 'h-52 w-full bg-cover bg-center'
          }
          style={{ backgroundImage: `url(${place.imageUrl})` }}
        />
      )}

      <div className="flex h-full min-h-0 flex-col">
        <div
          className="flex items-start justify-between gap-4 px-5 pb-4 pt-5"
          onTouchStart={isMobile ? handleTouchStart : undefined}
          onTouchMove={isMobile ? handleTouchMove : undefined}
          onTouchEnd={isMobile ? handleTouchEnd : undefined}
        >
          <div className="min-w-0">
            <p className="text-sm capitalize text-gray-500">{place.category}</p>
            <h2 className="text-2xl font-bold text-gray-900">{place.name}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border px-3 py-1 text-sm text-gray-600 transition hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {place.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {place.options.map(option => (
                <span
                  key={option}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                >
                  {option}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Upcoming events
              </h3>

              <span className="rounded-full bg-black px-2.5 py-1 text-xs font-semibold text-white">
                {sortedEvents.length} {sortedEvents.length === 1 ? 'event' : 'events'}
              </span>
            </div>

            <div className="space-y-3">
              {sortedEvents.length > 0 ? (
                sortedEvents.map(event => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-gray-900">{event.title}</p>

                      <div className="flex items-center gap-2">
                        {event.highlight && (
                          <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                            HOT
                          </span>
                        )}

                        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {formatEventDateLabel(event.date)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <span>🕒 {event.time}</span>
                      {event.category && <span>🎧 {event.category}</span>}
                      {event.price && <span>💰 {event.price}</span>}
                    </div>

                    <p className="mt-2 text-sm leading-6 text-gray-700">
                      {event.description}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-700">
                    No upcoming events yet
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    This place is visible, but there are no matching events for
                    the current filters.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              About this place
            </h3>
            <p className="text-sm leading-6 text-gray-700">{place.description}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}