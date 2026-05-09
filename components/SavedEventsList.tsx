'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock3, Heart, MapPin } from 'lucide-react'
import SaveEventButton from '@/components/SaveEventButton'

export type SavedEventCard = {
  id: string
  slug: string
  title: string
  date: string
  time: string
  category: string
  highlight: boolean | null
  price: string | null
  location_label: string
  venue_name: string | null
}

function getCategoryTone(category?: string) {
  if (!category) return 'bg-white/10 text-white/80'
  const value = category.toLowerCase()
  if (value === 'nightlife') return 'bg-fuchsia-500/20 text-fuchsia-300'
  if (value === 'music') return 'bg-violet-500/20 text-violet-300'
  if (value === 'sports') return 'bg-emerald-500/20 text-emerald-300'
  if (value === 'culture') return 'bg-sky-500/20 text-sky-300'
  if (value === 'food') return 'bg-amber-500/20 text-amber-300'
  return 'bg-white/10 text-white/80'
}

export default function SavedEventsList({
  initialEvents,
}: {
  initialEvents: SavedEventCard[]
}) {
  const [events, setEvents] = useState(initialEvents)

  if (events.length === 0) {
    return (
      <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <Heart className="mx-auto h-8 w-8 text-white/20" />
        <p className="mt-4 font-semibold text-white">No saved events yet</p>
        <p className="mt-1 text-sm text-white/50">
          Browse events and tap the heart to save them here.
        </p>
        <Link
          href="/events"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Browse events
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {events.map((event) => (
        <Link
          key={event.id}
          href={`/events/${event.slug}`}
          className="group block rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/15 hover:bg-white/[0.05]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getCategoryTone(
                  event.category
                )}`}
              >
                {event.category}
              </span>
              {event.price && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/80">
                  {event.price}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {event.highlight && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                  Hot
                </span>
              )}

              <SaveEventButton
                eventId={event.id}
                initialSaved={true}
                isAuthenticated={true}
                onToggle={(saved) => {
                  if (!saved) {
                    setEvents((prev) => prev.filter((e) => e.id !== event.id))
                  }
                }}
              />
            </div>
          </div>

          <h3 className="mt-4 text-lg font-semibold leading-tight text-white">
            {event.title}
          </h3>

          {event.venue_name && (
            <div className="mt-2 flex items-center gap-2 text-sm text-white/55">
              <MapPin className="h-4 w-4" />
              <span>{event.venue_name}</span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60">
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {event.date}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {event.time}
            </span>
            <span className="inline-flex items-center gap-2 text-white/45">
              <MapPin className="h-3.5 w-3.5" />
              {event.location_label}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
