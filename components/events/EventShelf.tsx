'use client'

import { useRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import EventCard, { type PublicEvent } from './EventCard'
import EventSpotlight from './EventSpotlight'
import EventWideCard from './EventWideCard'
import { RAIL_TRACK_CLASS, RailArrows, useScrollArrows } from './EventRow'

type CardContext = { venueName: string | null; cityLabel: string }

/**
 * A titled set of events whose layout adapts to how many there are, so a
 * thin catalog never shows a lonely card beside empty space:
 *   1  → spotlight banner (desktop) / one poster card (phone)
 *   2  → two wide cards (desktop) / swipe row (phone)
 *   3  → three posters across (desktop) / swipe row (phone)
 *   4+ → sliding row, four across on desktop, arrows in the heading
 */
export default function EventShelf({
  heading,
  events,
  context,
  isAuthenticated,
  savedIds,
  spotlightLabel,
}: {
  heading: ReactNode
  events: PublicEvent[]
  context: (event: PublicEvent) => CardContext
  isAuthenticated: boolean
  savedIds: Set<string>
  /** Chip on the single-event spotlight, e.g. "Next up in Berlin". */
  spotlightLabel: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const arrows = useScrollArrows(trackRef, events)
  const count = events.length
  if (count === 0) return null

  const props = (event: PublicEvent) => ({
    event,
    ...context(event),
    isAuthenticated,
    initialSaved: savedIds.has(event.id),
  })

  const card = (event: PublicEvent, className: string) => (
    <motion.div
      key={event.id}
      role="listitem"
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={`shrink-0 snap-start ${className}`}
    >
      <EventCard {...props(event)} />
    </motion.div>
  )

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">{heading}</div>
        {count >= 4 && (
          <div className="hidden sm:block">
            <RailArrows {...arrows} />
          </div>
        )}
      </div>

      {count === 1 && (
        <>
          <div className="md:hidden">{card(events[0], '')}</div>
          <div className="hidden pt-2 md:block">
            <EventSpotlight {...props(events[0])} label={spotlightLabel} />
          </div>
        </>
      )}

      {count === 2 && (
        <>
          <div role="list" className={`${RAIL_TRACK_CLASS} md:hidden`}>
            {events.map((event) => card(event, 'w-[80%]'))}
          </div>
          <div className="hidden gap-5 pt-2 md:grid lg:grid-cols-2">
            {events.map((event) => (
              <motion.div key={event.id} whileTap={{ scale: 0.99 }}>
                <EventWideCard {...props(event)} />
              </motion.div>
            ))}
          </div>
        </>
      )}

      {count === 3 && (
        <div
          role="list"
          className={`${RAIL_TRACK_CLASS} md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0`}
        >
          {events.map((event) => card(event, 'w-[80%] md:w-auto'))}
        </div>
      )}

      {count >= 4 && (
        <div ref={trackRef} role="list" className={RAIL_TRACK_CLASS}>
          {events.map((event) =>
            card(
              event,
              'w-[80%] sm:w-[calc((100%-2*1.25rem)/3)] lg:w-[calc((100%-3*1.25rem)/4)]',
            ),
          )}
        </div>
      )}
    </div>
  )
}
