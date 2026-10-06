'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Armchair,
  ArrowLeft,
  BellRing,
  Check,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { languageLocales } from '@/lib/i18n/config'
import { trackInteraction } from '@/lib/track'
import { formatMoney } from '@/lib/seats/format'
import type { PublicSeatCategory, PublicSeatSale } from '@/lib/seats/types'

// Seat sales on the event page (phase 43). Presentation + honest error states
// only — availability, "sits together", caps and holds are all enforced by
// seat_reserve under a row lock. No payment step yet: a reservation is held
// until the seller confirms payment.

type Props = {
  eventId: string
  slug: string
  sale: PublicSeatSale
  isAuthenticated: boolean
  defaultName: string | null
  defaultEmail: string | null
  city: string | null
  country: string | null
}

const ERROR_KEYS: Record<string, string> = {
  sold_out: 'seat_err_sold_out',
  not_together: 'seat_err_not_together',
  user_cap_reached: 'seat_err_cap',
  sales_closed: 'seat_err_closed',
  category_not_on_sale: 'seat_err_closed',
  sale_not_found: 'seat_err_closed',
  bad_details: 'seat_err_details',
  bad_quantity: 'seat_err_generic',
  rate_limited: 'seat_err_rate',
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))

const INPUT =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-flame-400/60 focus:outline-none'

export default function SeatSalePanel({
  eventId,
  slug,
  sale,
  isAuthenticated,
  defaultName,
  defaultEmail,
  city,
  country,
}: Props) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const locale = languageLocales[language]
  const money = (cents: number) => formatMoney(cents, sale.currency, locale)

  const sellable = sale.categories.filter((c) => c.available > 0 && c.max_together > 0)
  const soldOut = sale.mode === 'live' && sellable.length === 0
  const [code, setCode] = useState<string | null>(sellable[0]?.code ?? null)
  const [quantity, setQuantity] = useState(2)
  const [step, setStep] = useState<'pick' | 'details'>('pick')
  const [busy, setBusy] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  const [name, setName] = useState(defaultName ?? '')
  const [eventimEmail, setEventimEmail] = useState(defaultEmail ?? '')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)

  const [wlEmail, setWlEmail] = useState(defaultEmail ?? '')
  const [wlCity, setWlCity] = useState('')
  const [wlDone, setWlDone] = useState(false)

  useEffect(() => {
    trackInteraction('ticket_view_tiers', {
      entityType: 'event',
      entityId: eventId,
      city,
      country,
      meta: { kind: 'seats', mode: sale.mode },
    })
    // Mount-only analytics ping, once per page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = sale.categories.find((c) => c.code === code) ?? null
  const maxQty = selected ? Math.max(1, selected.max_together) : 1
  const qty = Math.min(Math.max(1, quantity), maxQty)
  const lowest = sale.categories.reduce<number | null>(
    (min, c) => (min === null || c.price_cents < min ? c.price_cents : min),
    null,
  )
  const deliverBy = sale.deliver_by
    ? new Date(`${sale.deliver_by}T12:00:00`).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
      })
    : null

  const choose = (category: PublicSeatCategory) => {
    if (busy || category.available <= 0) return
    setCode(category.code)
    setErrorKey(null)
  }

  const startReserve = () => {
    if (!selected || busy) return
    if (!isAuthenticated) {
      router.push(`/sign-in?next=${encodeURIComponent(`/events/${slug}`)}`)
      return
    }
    setErrorKey(null)
    setStep('details')
  }

  const reserve = async () => {
    if (!selected || busy || !consent) return
    setBusy(true)
    setErrorKey(null)
    try {
      const res = await fetch('/api/seats/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          category: selected.code,
          quantity: qty,
          buyerName: name,
          eventimEmail,
          phone,
          note,
        }),
      })
      const payload = (await res.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null
      if (res.ok && payload?.id) {
        trackInteraction('ticket_claim', {
          entityType: 'event',
          entityId: eventId,
          city,
          country,
          meta: { kind: 'seats', quantity: qty, category: selected.code },
        })
        router.push(`/dashboard/seats?new=${payload.id}`)
        return
      }
      const errCode = payload?.error ?? 'reserve_failed'
      if (errCode === 'auth_required') {
        router.push(`/sign-in?next=${encodeURIComponent(`/events/${slug}`)}`)
        return
      }
      setErrorKey(ERROR_KEYS[errCode] ?? 'seat_err_generic')
      trackInteraction('ticket_claim_blocked', {
        entityType: 'event',
        entityId: eventId,
        city,
        country,
        meta: { kind: 'seats', reason: errCode },
      })
      if (errCode === 'sold_out' || errCode === 'not_together') {
        setStep('pick')
        router.refresh()
      }
    } catch {
      setErrorKey('seat_err_generic')
    } finally {
      setBusy(false)
    }
  }

  const joinWaitlist = async () => {
    if (busy) return
    setBusy(true)
    setErrorKey(null)
    try {
      const res = await fetch('/api/seats/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          name,
          email: wlEmail,
          category: code,
          quantity: qty,
          city: wlCity,
        }),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        setWlDone(true)
      } else {
        setErrorKey(ERROR_KEYS[payload?.error ?? ''] ?? 'seat_err_generic')
      }
    } catch {
      setErrorKey('seat_err_generic')
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        <Armchair className="h-3.5 w-3.5" />
        {t('seat_label')}
      </span>
      <span className="text-lg font-semibold text-white">
        {sale.mode === 'closed' || soldOut
          ? t('seat_sold_out')
          : lowest !== null
            ? `${t('seat_from')} ${money(lowest)}`
            : null}
      </span>
    </div>
  )

  const draftBadge =
    sale.mode === 'draft' ? (
      <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-200">
        {t('seat_draft_badge')}
      </p>
    ) : null

  const errorBox = errorKey ? (
    <p
      role="alert"
      className="mt-3 rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100"
    >
      {t(errorKey)}
    </p>
  ) : null

  if (sale.mode === 'closed') {
    return (
      <div className="mt-5 border-t border-white/[0.08] pt-5">
        {header}
        <p className="mt-3 text-sm text-white/55">{t('seat_closed')}</p>
      </div>
    )
  }

  const categoryList = (
    <div className="mt-3 space-y-2">
      {sale.categories.map((category) => {
        const gone = category.available <= 0
        const isSelected = category.code === code && !gone
        return (
          <button
            key={category.code}
            type="button"
            onClick={() => choose(category)}
            disabled={gone || busy}
            aria-pressed={isSelected}
            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
              isSelected
                ? 'border-flame-500/60 bg-flame-500/10'
                : gone
                  ? 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-60'
                  : 'border-white/10 bg-white/[0.04] hover:border-white/25'
            }`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                      isSelected ? 'border-flame-400 bg-flame-500' : 'border-white/25'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span className="text-sm font-semibold leading-snug text-white">{category.label}</span>
                </span>
                <span className="mt-1 block pl-6 text-xs text-white/50">
                  {gone
                    ? t('seat_sold_out')
                    : [
                        fill(t('seat_left'), { n: category.available }),
                        category.max_together > 1
                          ? fill(t('seat_together_max'), { n: category.max_together })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
              </span>
              <span className="flex-shrink-0 text-right">
                <span className="block text-sm font-semibold text-white">{money(category.price_cents)}</span>
                {category.face_value_cents !== null && (
                  <span className="block text-[11px] text-white/40">
                    {fill(t('seat_face_value'), { price: money(category.face_value_cents) })}
                  </span>
                )}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )

  const quantityRow = selected && selected.available > 0 && (
    <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
      <span className="text-sm text-white/70">{t('seat_quantity')}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setQuantity(Math.max(1, qty - 1))}
          disabled={qty <= 1 || busy}
          aria-label="−1"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-6 text-center text-base font-bold tabular-nums text-white">{qty}</span>
        <button
          type="button"
          onClick={() => setQuantity(Math.min(maxQty, qty + 1))}
          disabled={qty >= maxQty || busy}
          aria-label="+1"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )

  // Waitlist: before launch, or when everything is gone (holds that lapse
  // and cancellations put seats back).
  if (sale.mode === 'waitlist' || soldOut) {
    return (
      <div className="mt-5 border-t border-white/[0.08] pt-5">
        {draftBadge}
        {header}
        {sale.mode === 'waitlist' && categoryList}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {wlDone ? (
            <p className="inline-flex items-start gap-2 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {t('seat_waitlist_done')}
            </p>
          ) : (
            <>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                <BellRing className="h-4 w-4 text-flame-300" />
                {soldOut ? t('seat_waitlist_soldout_title') : t('seat_waitlist_title')}
              </p>
              <p className="mt-1 text-xs text-white/55">{t('seat_waitlist_sub')}</p>
              <div className="mt-3 space-y-2">
                <input
                  className={INPUT}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('seat_form_name')}
                  autoComplete="name"
                  maxLength={120}
                />
                <input
                  className={INPUT}
                  type="email"
                  value={wlEmail}
                  onChange={(e) => setWlEmail(e.target.value)}
                  placeholder={t('seat_waitlist_email')}
                  autoComplete="email"
                  maxLength={254}
                />
                <input
                  className={INPUT}
                  value={wlCity}
                  onChange={(e) => setWlCity(e.target.value)}
                  placeholder={t('seat_waitlist_city')}
                  autoComplete="address-level2"
                  maxLength={80}
                />
              </div>
              {sale.mode === 'waitlist' && quantityRow}
              {errorBox}
              <button
                type="button"
                onClick={() => void joinWaitlist()}
                disabled={busy || name.trim().length < 2 || !wlEmail.includes('@')}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                {t('seat_waitlist_cta')}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const trust = (
    <ul className="mt-4 space-y-2 text-xs text-white/60">
      <li className="flex items-start gap-2">
        <Users className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-flame-300" />
        {t('seat_trust_together')}
      </li>
      <li className="flex items-start gap-2">
        <Smartphone className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-flame-300" />
        {deliverBy
          ? fill(t('seat_trust_delivery_by'), { date: deliverBy })
          : t('seat_trust_delivery')}
      </li>
      <li className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-flame-300" />
        {t('seat_trust_refund')}
      </li>
    </ul>
  )

  if (step === 'details' && selected) {
    const total = selected.price_cents * qty
    const canSubmit =
      consent && name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(eventimEmail.trim())
    return (
      <div className="mt-5 border-t border-white/[0.08] pt-5">
        {draftBadge}
        <button
          type="button"
          onClick={() => setStep('pick')}
          disabled={busy}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('seat_form_back')}
        </button>

        <div className="rounded-2xl border border-flame-500/30 bg-flame-500/[0.07] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-white">
              {qty} × {selected.label}
            </span>
            <span className="text-base font-bold text-white">{money(total)}</span>
          </div>
          <p className="mt-1 text-xs text-white/55">{t('seat_trust_together')}</p>
        </div>

        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          {t('seat_form_title')}
        </p>
        <div className="mt-2 space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">{t('seat_form_name')}</span>
            <input
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">{t('seat_form_eventim_email')}</span>
            <input
              className={INPUT}
              type="email"
              value={eventimEmail}
              onChange={(e) => setEventimEmail(e.target.value)}
              autoComplete="email"
              maxLength={254}
            />
            <span className="mt-1 block text-[11px] leading-snug text-white/45">
              {t('seat_form_eventim_hint')}
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">{t('seat_form_phone')}</span>
            <input
              className={INPUT}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              maxLength={40}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">{t('seat_form_note')}</span>
            <textarea
              className={`${INPUT} min-h-[64px] resize-y`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </label>
          <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-flame-500"
            />
            <span className="text-xs leading-snug text-white/65">{t('seat_form_consent')}</span>
          </label>
        </div>

        {errorBox}

        <button
          type="button"
          onClick={() => void reserve()}
          disabled={busy || !canSubmit}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:-translate-y-0.5 hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('seat_reserving')}
            </>
          ) : (
            <>
              <Armchair className="h-4 w-4" />
              {t('seat_form_submit')}
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[11px] text-white/45">
          {fill(t('seat_hold_hint'), { hours: Math.round(sale.hold_minutes / 60) })}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-5 border-t border-white/[0.08] pt-5">
      {draftBadge}
      {header}
      {categoryList}
      {quantityRow}
      {trust}
      {errorBox}
      <button
        type="button"
        onClick={startReserve}
        disabled={busy || !selected || selected.available <= 0}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:-translate-y-0.5 hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0"
      >
        <Armchair className="h-4 w-4" />
        {selected ? fill(t('seat_reserve_cta'), { n: qty }) : t('seat_pick_category')}
      </button>
      {!isAuthenticated && (
        <p className="mt-2 text-center text-xs text-white/50">{t('seat_signin_hint')}</p>
      )}
      {(sale.seller_name || sale.public_note) && (
        <div className="mt-4 space-y-1 text-[11px] leading-snug text-white/40">
          {sale.seller_name && <p>{fill(t('seat_sold_by'), { name: sale.seller_name })}</p>}
          {sale.public_note && <p>{sale.public_note}</p>}
        </div>
      )}
    </div>
  )
}
