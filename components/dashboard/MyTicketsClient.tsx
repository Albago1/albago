'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, MapPin, QrCode, Ticket, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { languageLocales } from '@/lib/i18n/config'
import LocalizedEventText from '@/components/events/LocalizedEventText'

// My Tickets (TIX-1 Stage D). The ticket card is a fan artifact, not a
// receipt: event art leads, the time is flame-prominent, the QR opens as a
// fullscreen white sheet at door-scanning contrast. QR data URLs are signed
// and rendered SERVER-side (signTicketToken never reaches the client); this
// component only displays them.

export type TicketCardData = {
  id: string
  serial: string
  status: string
  tierName: string | null
  qrDataUrl: string | null
  isPast: boolean
  event: {
    slug: string
    title: string
    titleI18n: Record<string, string> | null
    date: string
    time: string | null
    city: string
    country: string | null
    venueName: string | null
    isOnline: boolean
    art: string | null
  }
}

function kickerLabel(date: string, time: string | null, locale: string): string {
  const day = new Date(`${date}T00:00:00`)
  const label = day
    .toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase()
  return time ? `${label} · ${time.slice(0, 5)}` : label
}

function StatusPill({ status }: { status: string }) {
  const { t } = useLanguage()
  if (status === 'checked_in') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/85">
        <CheckCircle2 className="h-3 w-3" />
        {t('tix_status_checked_in')}
      </span>
    )
  }
  if (status === 'void' || status === 'refunded') {
    return (
      <span className="rounded-full border border-red-500/35 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-200">
        {t('tix_status_void')}
      </span>
    )
  }
  return (
    <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
      {t('tix_status_valid')}
    </span>
  )
}

function TicketCard({
  ticket,
  onShowQr,
}: {
  ticket: TicketCardData
  onShowQr: (ticket: TicketCardData) => void
}) {
  const { t, language } = useLanguage()
  const locale = languageLocales[language]
  const showable = ticket.qrDataUrl !== null

  return (
    <article
      className={`overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] ${
        ticket.isPast ? 'opacity-75' : ''
      }`}
    >
      {/* Art header — event photo with an ink scrim, brand backdrop otherwise */}
      <Link
        href={`/events/${ticket.event.slug}`}
        className="relative block h-32 sm:h-36"
      >
        {ticket.event.art ? (
          <>
            <Image
              src={ticket.event.art}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className={`object-cover ${ticket.isPast ? 'grayscale-[0.4]' : ''}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/25 to-ink-950/10" />
          </>
        ) : (
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-grid opacity-40" />
            <div className="absolute inset-0 bg-radial-flame" />
          </div>
        )}
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-flame-300">
            {kickerLabel(ticket.event.date, ticket.event.time, locale)}
          </p>
          <h3 className="mt-1 truncate text-lg font-bold text-white">
            <LocalizedEventText
              base={ticket.event.title}
              i18n={ticket.event.titleI18n}
              asText
            />
          </h3>
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-white/60">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-white/40" />
            <span className="truncate">
              {ticket.event.isOnline
                ? 'Online'
                : [ticket.event.venueName, ticket.event.city]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
          </p>
          <StatusPill status={ticket.status} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed border-white/15 pt-3">
          <div className="min-w-0">
            {ticket.tierName && (
              <p className="truncate text-xs font-semibold text-white/75">
                {ticket.tierName}
              </p>
            )}
            <p className="font-mono text-xs tabular-nums tracking-wider text-white/50">
              {ticket.serial}
            </p>
          </div>
          {showable && (
            <button
              type="button"
              onClick={() => onShowQr(ticket)}
              className={`inline-flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                ticket.isPast
                  ? 'border border-white/15 bg-white/[0.05] text-white/75 hover:bg-white/10'
                  : 'bg-flame-500 text-white shadow-glow-flame hover:bg-flame-400'
              }`}
            >
              <QrCode className="h-3.5 w-3.5" />
              {t('tix_show_qr')}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function MyTicketsClient({ tickets }: { tickets: TicketCardData[] }) {
  const { t, language } = useLanguage()
  const [openTicket, setOpenTicket] = useState<TicketCardData | null>(null)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  const upcoming = tickets.filter((ticket) => !ticket.isPast)
  const past = tickets.filter((ticket) => ticket.isPast)

  // Keep the screen awake while the QR sheet is up — the phone dimming at the
  // door is exactly the failure mode this page exists to prevent.
  useEffect(() => {
    if (!openTicket) return
    let cancelled = false
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
    }
    nav.wakeLock
      ?.request('screen')
      .then((sentinel) => {
        if (cancelled) void sentinel.release()
        else wakeLockRef.current = sentinel
      })
      .catch(() => {})
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      cancelled = true
      void wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
      document.body.style.overflow = previousOverflow
    }
  }, [openTicket])

  return (
    <>
      <h1 className="display-text text-4xl tracking-tight sm:text-5xl">
        {t('tix_my_title')}
      </h1>
      <p className="mt-2 text-white/60">{t('tix_my_sub')}</p>

      {tickets.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <Ticket className="mx-auto h-8 w-8 text-white/30" />
          <p className="mt-4 text-lg font-semibold text-white">
            {t('tix_empty_title')}
          </p>
          <p className="mt-1 text-sm text-white/55">{t('tix_empty_sub')}</p>
          <Link
            href="/events"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400"
          >
            {t('tix_browse')}
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                {t('tix_upcoming')}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {upcoming.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} onShowQr={setOpenTicket} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                {t('tix_past')}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {past.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} onShowQr={setOpenTicket} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Fullscreen door sheet — max contrast, wake-locked, tap to dismiss */}
      {openTicket && openTicket.qrDataUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('tix_show_qr')}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-white px-6 text-center"
          onClick={() => setOpenTicket(null)}
        >
          <button
            type="button"
            aria-label={t('close')}
            onClick={() => setOpenTicket(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.06] text-black transition hover:bg-black/10"
          >
            <X className="h-5 w-5" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR; next/image adds nothing */}
          <img
            src={openTicket.qrDataUrl}
            alt=""
            className="w-[78vw] max-w-xs rounded-2xl"
            draggable={false}
          />
          <p className="mt-4 font-mono text-xl font-bold tabular-nums tracking-[0.2em] text-black">
            {openTicket.serial}
          </p>
          <p className="mt-2 max-w-xs text-sm font-semibold text-black/75">
            <LocalizedEventText
              base={openTicket.event.title}
              i18n={openTicket.event.titleI18n}
              asText
            />
          </p>
          <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.18em] text-black/50">
            {kickerLabel(
              openTicket.event.date,
              openTicket.event.time,
              languageLocales[language],
            )}
          </p>
          {openTicket.status === 'checked_in' && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/[0.06] px-3 py-1 text-xs font-bold uppercase tracking-wide text-black/70">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('tix_status_checked_in')}
            </p>
          )}
          <p className="mt-6 max-w-xs text-xs text-black/45">{t('tix_qr_hint')}</p>
        </div>
      )}
    </>
  )
}
