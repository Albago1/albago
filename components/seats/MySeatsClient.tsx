'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Armchair,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  PartyPopper,
  Smartphone,
  XCircle,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { languageLocales } from '@/lib/i18n/config'
import {
  RESERVATION_STEPS,
  effectiveStatus,
  formatMoney,
  groupSeats,
  stepIndex,
} from '@/lib/seats/format'
import type { ReservationStatus, SeatReservationRow } from '@/lib/seats/types'

export type MySeatCard = {
  reservation: SeatReservationRow
  deliverBy: string | null
  sellerName: string | null
  event: {
    slug: string
    title: string
    titleI18n: Record<string, string> | null
    date: string
    time: string | null
    venue: string
    art: string | null
  } | null
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))

const STEP_KEYS: Record<(typeof RESERVATION_STEPS)[number], string> = {
  held: 'seat_step_reserved',
  paid: 'seat_step_paid',
  transfer_sent: 'seat_step_sent',
  delivered: 'seat_step_received',
}

const BADGE: Record<ReservationStatus, string> = {
  held: 'border-amber-400/35 bg-amber-400/10 text-amber-200',
  paid: 'border-sky-400/35 bg-sky-400/10 text-sky-200',
  transfer_sent: 'border-violet-400/35 bg-violet-400/10 text-violet-200',
  delivered: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200',
  cancelled: 'border-white/15 bg-white/[0.04] text-white/50',
  expired: 'border-white/15 bg-white/[0.04] text-white/50',
  refunded: 'border-white/15 bg-white/[0.04] text-white/60',
}

function SeatCard({ card, highlight }: { card: MySeatCard; highlight: boolean }) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const locale = languageLocales[language]
  const r = card.reservation
  const status = effectiveStatus(r.status, r.expires_at)
  const current = stepIndex(status)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState(false)

  const dateTime = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  const deliverBy = card.deliverBy
    ? new Date(`${card.deliverBy}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
    : null
  const title = card.event ? card.event.titleI18n?.[language] || card.event.title : r.category_label

  const act = async (action: 'cancel' | 'confirm_received') => {
    if (busy) return
    if (action === 'cancel' && !window.confirm(t('seat_cancel_confirm'))) return
    setBusy(action)
    setError(false)
    try {
      const res = await fetch(`/api/seats/${r.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) setError(true)
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(r.reference)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the reference is visible anyway */
    }
  }

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white/[0.03] ${
        highlight ? 'border-flame-500/50 shadow-glow-flame' : 'border-white/10'
      }`}
    >
      {card.event && (
        <Link href={`/events/${card.event.slug}`} className="flex items-center gap-4 border-b border-white/[0.06] p-4">
          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-white/[0.06]">
            {card.event.art ? (
              <Image src={card.event.art} alt="" fill sizes="56px" className="object-cover" />
            ) : (
              <Armchair className="absolute inset-0 m-auto h-6 w-6 text-white/30" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{title}</p>
            <p className="mt-0.5 truncate text-xs text-white/55">
              {new Date(`${card.event.date}T12:00:00`).toLocaleDateString(locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
              })}
              {card.event.time ? ` · ${card.event.time.slice(0, 5)}` : ''}
              {card.event.venue ? ` · ${card.event.venue}` : ''}
            </p>
          </div>
        </Link>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${BADGE[status]}`}>
            {t(`seat_status_${status}`)}
          </span>
          <button
            type="button"
            onClick={() => void copyRef()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-950/50 px-3 py-1 font-mono text-xs tabular-nums text-white/80 transition hover:bg-white/[0.06]"
            title={t('seat_ref')}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            {r.reference}
          </button>
        </div>

        {current >= 0 && (
          <ol className="mt-4 grid grid-cols-4 gap-1.5">
            {RESERVATION_STEPS.map((step, i) => (
              <li key={step} className="min-w-0">
                <span
                  className={`block h-1.5 rounded-full ${
                    i <= current ? 'bg-flame-500' : 'bg-white/10'
                  }`}
                />
                <span
                  className={`mt-1.5 block truncate text-[10px] font-semibold uppercase tracking-wide ${
                    i <= current ? 'text-white/80' : 'text-white/35'
                  }`}
                >
                  {t(STEP_KEYS[step])}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-white">
            {r.quantity} × {r.category_label}
          </p>
          <p className="text-base font-bold text-white">{formatMoney(r.total_cents, r.currency, locale)}</p>
        </div>
        <ul className="mt-2 space-y-1">
          {groupSeats(r.seats).map((g) => (
            <li key={`${g.area}-${g.block}-${g.row}`} className="text-xs text-white/60">
              {g.area}
              {g.block !== '-' ? ` · ${t('seat_block')} ${g.block}` : ''} · {t('seat_row')} {g.row} ·{' '}
              {t('seat_seats')} {g.seats}
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-2xl border border-white/10 bg-ink-950/40 p-4 text-sm text-white/75">
          {status === 'held' && (
            <>
              <p className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                <span>
                  {fill(t('seat_next_payment'), { ref: r.reference })}
                  {r.expires_at && (
                    <span className="mt-1 block text-xs text-white/50">
                      {fill(t('seat_held_until'), { date: dateTime(r.expires_at) })}
                    </span>
                  )}
                </span>
              </p>
              <button
                type="button"
                onClick={() => void act('cancel')}
                disabled={!!busy}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white/50 transition hover:text-red-200 disabled:opacity-50"
              >
                {busy === 'cancel' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                {t('seat_cancel_hold')}
              </button>
            </>
          )}
          {status === 'paid' && (
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-300" />
              <span>
                {fill(t('seat_next_paid'), { email: r.eventim_email })}
                {deliverBy && (
                  <span className="mt-1 block text-xs text-white/50">
                    {fill(t('seat_deliver_by'), { date: deliverBy })}
                  </span>
                )}
              </span>
            </p>
          )}
          {status === 'transfer_sent' && (
            <>
              <p className="flex items-start gap-2">
                <Smartphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-300" />
                <span>{fill(t('seat_next_sent'), { email: r.eventim_email })}</span>
              </p>
              <button
                type="button"
                onClick={() => void act('confirm_received')}
                disabled={!!busy}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 disabled:opacity-50 sm:w-auto"
              >
                {busy === 'confirm_received' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t('seat_confirm_received')}
              </button>
            </>
          )}
          {status === 'delivered' && (
            <p className="flex items-start gap-2">
              <PartyPopper className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
              <span>{t('seat_delivered_note')}</span>
            </p>
          )}
          {status === 'cancelled' && <p>{t('seat_cancelled_note')}</p>}
          {status === 'expired' && <p>{t('seat_expired_note')}</p>}
          {status === 'refunded' && <p>{t('seat_refunded_note')}</p>}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-red-200">
            {t('seat_err_generic')}
          </p>
        )}
        {card.sellerName && (
          <p className="mt-3 text-[11px] text-white/40">{fill(t('seat_sold_by'), { name: card.sellerName })}</p>
        )}
      </div>
    </article>
  )
}

export default function MySeatsClient({ cards, newId }: { cards: MySeatCard[]; newId: string | null }) {
  const { t } = useLanguage()
  const isNew = !!newId && cards.some((c) => c.reservation.id === newId)

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{t('seat_my_title')}</h1>
      <p className="mt-2 text-sm text-white/55">{t('seat_my_sub')}</p>

      {isNew && (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="inline-flex items-center gap-2 text-base font-bold text-white">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            {t('seat_success_title')}
          </p>
          <p className="mt-1 text-sm text-white/75">{t('seat_success_sub')}</p>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Armchair className="mx-auto h-8 w-8 text-white/30" />
          <p className="mt-3 font-semibold text-white">{t('seat_my_empty_title')}</p>
          <p className="mt-1 text-sm text-white/50">{t('seat_my_empty_sub')}</p>
          <Link
            href="/events"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-flame-400"
          >
            {t('tix_browse')}
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {cards.map((card) => (
            <SeatCard key={card.reservation.id} card={card} highlight={card.reservation.id === newId} />
          ))}
        </div>
      )}
    </div>
  )
}
