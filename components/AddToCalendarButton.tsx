'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Apple,
  Calendar as CalendarIcon,
  ChevronDown,
  ExternalLink,
  Mail,
} from 'lucide-react'
import {
  buildGoogleCalendarUrl,
  buildOutlookUrl,
  buildYahooUrl,
  downloadIcsFile,
  type CalendarEventInput,
} from '@/lib/calendarLinks'

type Props = {
  event: Omit<CalendarEventInput, 'pageUrl'> & { pageUrl?: string }
  variant?: 'primary' | 'secondary'
  label?: string
}

export default function AddToCalendarButton({
  event,
  variant = 'secondary',
  label = 'Add to calendar',
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Resolve the canonical URL on the client. The server-rendered fallback uses
  // the production domain so the calendar entry still links somewhere useful
  // if a viewer opens the .ics file later from a different device.
  const calendarEvent: CalendarEventInput = useMemo(() => {
    const origin =
      event.pageUrl ??
      (typeof window !== 'undefined'
        ? `${window.location.origin}/events/${event.slug}`
        : `https://albago.org/events/${event.slug}`)
    return { ...event, pageUrl: origin }
  }, [event])

  useEffect(() => {
    if (!isOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
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
      : 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white'

  const iconSize = 'h-4 w-4'

  const googleHref = buildGoogleCalendarUrl(calendarEvent)
  const outlookHref = buildOutlookUrl(calendarEvent)
  const yahooHref = buildYahooUrl(calendarEvent)

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={buttonClass}
      >
        <CalendarIcon className={iconSize} />
        {label}
        <ChevronDown
          className={`${iconSize} transition ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur"
        >
          <a
            role="menuitem"
            href={googleHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <CalendarIcon className="h-3.5 w-3.5 text-white/85" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                Google Calendar
                <ExternalLink className="h-3 w-3 text-white/45" />
              </p>
              <p className="mt-0.5 text-xs text-white/55">
                Save to your Google account.
              </p>
            </div>
          </a>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false)
              downloadIcsFile(calendarEvent)
            }}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <Apple className="h-3.5 w-3.5 text-white/85" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Apple Calendar</p>
              <p className="mt-0.5 text-xs text-white/55">
                Download an .ics file (works on iOS, macOS, Linux).
              </p>
            </div>
          </button>

          <a
            role="menuitem"
            href={outlookHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <Mail className="h-3.5 w-3.5 text-white/85" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                Outlook
                <ExternalLink className="h-3 w-3 text-white/45" />
              </p>
              <p className="mt-0.5 text-xs text-white/55">
                Save to outlook.com or Office 365.
              </p>
            </div>
          </a>

          <a
            role="menuitem"
            href={yahooHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <CalendarIcon className="h-3.5 w-3.5 text-white/85" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                Yahoo Calendar
                <ExternalLink className="h-3 w-3 text-white/45" />
              </p>
              <p className="mt-0.5 text-xs text-white/55">
                Save to your Yahoo calendar.
              </p>
            </div>
          </a>

          {!event.timezone && (
            <p className="mt-1 border-t border-white/[0.06] px-3 pb-2 pt-2 text-[10px] leading-4 text-white/45">
              Time is local to {event.country ? `${event.city}, ${event.country}` : event.city}.
              Your calendar may display it in its own zone.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
