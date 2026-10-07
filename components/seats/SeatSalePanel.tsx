'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Armchair,
  ArrowLeft,
  BellRing,
  Check,
  CheckCircle2,
  ChevronRight,
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
import { formatMoney, groupSeats } from '@/lib/seats/format'
import { blockKey, parseSeatKey, pickSeats, seatKeyOf } from '@/lib/seats/pick'
import { allBlocks, venueMapById } from '@/lib/seats/venueMaps'
import type { PublicSeatCategory, PublicSeatSale } from '@/lib/seats/types'
import SeatMapPicker from './SeatMapPicker'
import { StadiumPreview, stockOnMap } from './StadiumMap'

// Seat sales on the event page (phase 43). Presentation + honest error states
// only — availability, "sits together", caps and holds are all enforced by
// the seat_reserve RPCs under a row lock. No payment step yet: a reservation
// is held until the seller confirms payment.
//
// With a known venue the buyer picks exact seats in the full-screen seat
// picker (stadium → block → seats, like the big ticket shops); this card shows
// the stadium, the prices and the current selection. Without a venue map it
// falls back to category + quantity, best seats together.

type Props = {
  eventId: string
  slug: string
  sale: PublicSeatSale
  eventTitle: string
  /** YYYY-MM-DD */
  eventDate: string | null
  venueName: string | null
  /** lib/seats/venueMaps id (ids cross the server→client boundary; maps hold RegExps). */
  venueMapId: string | null
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
  seats_taken: 'seat_err_seats_taken',
  mixed_categories: 'seat_err_mixed',
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))

// Category colours on the map and the cards, most expensive first.
const CATEGORY_COLORS = ['#ee1c25', '#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#f472b6']

const INPUT =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-flame-400/60 focus:outline-none'

const PRIMARY =
  'inline-flex w-full items-center justify-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:-translate-y-0.5 hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0'

/** ?seats=1 in the URL = the seat picker is open (Back closes it). */
const PICKER_PARAM = 'seats'

const naturalCmp = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })

export default function SeatSalePanel({
  eventId,
  slug,
  sale,
  eventTitle,
  eventDate,
  venueName,
  venueMapId,
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
  const [picked, setPicked] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerFilter, setPickerFilter] = useState<string | null>(null)
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

  const runs = useMemo(() => sale.runs ?? [], [sale.runs])
  const allSeats = useMemo(() => sale.seats ?? [], [sale.seats])
  const venueMap = venueMapId ? venueMapById(venueMapId) : null
  const showMap = !!venueMap && (sale.blocks?.length ?? 0) > 0
  const mapFlow = showMap && allSeats.length > 0 && sale.mode !== 'waitlist'
  const colorFor = useMemo(() => {
    const byPrice = [...sale.categories].sort((a, b) => b.price_cents - a.price_cents)
    const colors = new Map(byPrice.map((c, i) => [c.code, CATEGORY_COLORS[i % CATEGORY_COLORS.length]]))
    return (category: string) => colors.get(category) ?? 'rgba(255,255,255,0.5)'
  }, [sale.categories])
  const stock = useMemo(
    () => (venueMap ? stockOnMap(venueMap, allBlocks(venueMap), sale.blocks ?? [], runs) : []),
    [venueMap, sale.blocks, runs],
  )

  // Exact seats (map flow). A seat someone else took since the page loaded
  // drops out of the selection.
  const seatIndex = useMemo(() => new Map(allSeats.map((s) => [seatKeyOf(s), s])), [allSeats])
  const activePicked = useMemo(() => picked.filter((k) => seatIndex.get(k)?.free), [picked, seatIndex])
  const pickedSeats = activePicked
    .map(parseSeatKey)
    .sort((a, b) => naturalCmp(a.block, b.block) || naturalCmp(a.row, b.row) || a.seat - b.seat)
  const pickedCategory = activePicked.length ? (seatIndex.get(activePicked[0])?.category ?? null) : null
  const exact = mapFlow && activePicked.length > 0
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const k of activePicked) {
      const key = blockKey(parseSeatKey(k))
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    return m
  }, [activePicked])

  // Category + quantity (no venue map).
  const selected = mapFlow
    ? (sale.categories.find((c) => c.code === pickedCategory) ?? null)
    : (sale.categories.find((c) => c.code === code) ?? null)
  const maxQty = selected ? Math.max(1, selected.max_together) : 1
  const qty = Math.min(Math.max(1, quantity), maxQty)
  const preview = !mapFlow && code ? pickSeats(runs, code, qty) : null
  const seatCount = mapFlow ? activePicked.length : qty

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
  const storeKey = `albago:seat-pick:${eventId}`

  // ---- picker open / close, in step with the browser's Back button ---------
  const pushed = useRef(false)
  const setUrlParam = (on: boolean, push: boolean) => {
    const url = new URL(window.location.href)
    if (on) url.searchParams.set(PICKER_PARAM, '1')
    else url.searchParams.delete(PICKER_PARAM)
    if (push) window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
  }

  const openPicker = (filter: string | null) => {
    setPickerFilter(filter)
    setErrorKey(null)
    setPickerOpen(true)
    if (!new URLSearchParams(window.location.search).has(PICKER_PARAM)) {
      setUrlParam(true, true)
      pushed.current = true
    }
  }

  const closePicker = () => {
    setPickerOpen(false)
    setStep('pick')
    if (pushed.current) {
      pushed.current = false
      window.history.back()
    } else {
      setUrlParam(false, false)
    }
  }

  useEffect(() => {
    const onPop = () => {
      if (!new URLSearchParams(window.location.search).has(PICKER_PARAM)) {
        pushed.current = false
        setPickerOpen(false)
        setStep('pick')
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Back from sign-in (?seats=1): reopen the picker with the saved selection.
  useEffect(() => {
    if (!mapFlow || !new URLSearchParams(window.location.search).has(PICKER_PARAM)) return
    let saved: string[] = []
    try {
      const raw = JSON.parse(window.sessionStorage.getItem(storeKey) ?? '[]')
      if (Array.isArray(raw)) saved = raw.filter((k): k is string => typeof k === 'string')
    } catch {
      /* nothing saved */
    }
    // One-off restore from the URL + session storage after the redirect.
    setPicked(saved)
    setPickerOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goSignIn = (next: string) => {
    router.push(`/sign-in?next=${encodeURIComponent(next)}`)
  }

  const continueFromPicker = () => {
    if (!exact || busy) return
    setErrorKey(null)
    if (!isAuthenticated) {
      try {
        window.sessionStorage.setItem(storeKey, JSON.stringify(activePicked))
      } catch {
        /* private mode — the buyer picks again after signing in */
      }
      goSignIn(`/events/${slug}?${PICKER_PARAM}=1`)
      return
    }
    setStep('details')
  }

  const choose = (category: PublicSeatCategory) => {
    if (busy || category.available <= 0) return
    setCode(category.code)
    setErrorKey(null)
  }

  const startReserve = () => {
    if (!selected || busy) return
    if (!isAuthenticated) {
      goSignIn(`/events/${slug}`)
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
        body: JSON.stringify(
          exact
            ? { eventId, seats: pickedSeats, buyerName: name, eventimEmail, phone, note }
            : {
                eventId,
                category: selected.code,
                quantity: qty,
                area: null,
                block: null,
                buyerName: name,
                eventimEmail,
                phone,
                note,
              },
        ),
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
          meta: { kind: 'seats', quantity: seatCount, category: selected.code, exact },
        })
        try {
          window.sessionStorage.removeItem(storeKey)
        } catch {
          /* ignore */
        }
        // Leave no "?seats=1" entry behind: Back from My Seats lands on the page.
        if (new URLSearchParams(window.location.search).has(PICKER_PARAM)) setUrlParam(false, false)
        router.push(`/dashboard/seats?new=${payload.id}`)
        return
      }
      const errCode = payload?.error ?? 'reserve_failed'
      if (errCode === 'auth_required') {
        goSignIn(`/events/${slug}`)
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
      if (errCode === 'sold_out' || errCode === 'not_together' || errCode === 'seats_taken') {
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

  const soldBy =
    sale.seller_name || sale.public_note ? (
      <div className="mt-4 space-y-1 text-[11px] leading-snug text-white/40">
        {sale.seller_name && <p>{fill(t('seat_sold_by'), { name: sale.seller_name })}</p>}
        {sale.public_note && <p>{sale.public_note}</p>}
      </div>
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
                  {showMap && (
                    <span
                      aria-hidden
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: gone ? 'rgba(255,255,255,0.25)' : colorFor(category.code) }}
                    />
                  )}
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

  const stadiumPicture = (counted: boolean) =>
    venueMap ? (
      <StadiumPreview
        map={venueMap}
        stock={stock}
        colorFor={colorFor}
        counts={counted ? counts : undefined}
        labels={{ floor: t('seat_floor'), ring: t('seat_ring') }}
      />
    ) : null

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
        {sale.mode === 'waitlist' && showMap && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-ink-950/40 p-2.5">{stadiumPicture(false)}</div>
        )}
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
                className={`mt-3 ${PRIMARY}`}
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
        {mapFlow ? t('seat_trust_exact') : t('seat_trust_together')}
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

  const checkout = (inPicker: boolean) => {
    if (!selected) return null
    const total = selected.price_cents * seatCount
    const canSubmit =
      consent && name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(eventimEmail.trim())
    return (
      <div>
        {!inPicker && (
          <button
            type="button"
            onClick={() => setStep('pick')}
            disabled={busy}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('seat_form_back')}
          </button>
        )}

        <div className="rounded-2xl border border-flame-500/30 bg-flame-500/[0.07] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-white">
              {seatCount} × {selected.label}
            </span>
            <span className="text-base font-bold text-white">{money(total)}</span>
          </div>
          <p className="mt-1 text-xs text-white/55">
            {exact
              ? groupSeats(pickedSeats)
                  .map((g) => `${t('seat_block')} ${g.block} · ${t('seat_row')} ${g.row} · ${t('seat_seats')} ${g.seats}`)
                  .join(' | ')
              : preview
                ? `${t('seat_block')} ${preview.block} · ${t('seat_row')} ${preview.row} · ${t('seat_seats')} ${preview.seats[0]}${preview.seats.length > 1 ? `–${preview.seats[preview.seats.length - 1]}` : ''}`
                : t('seat_trust_together')}
          </p>
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

        <button type="button" onClick={() => void reserve()} disabled={busy || !canSubmit} className={`mt-4 ${PRIMARY}`}>
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

  // ---- with a venue map: stadium card + full-screen picker ------------------
  if (mapFlow && venueMap) {
    const total = selected ? selected.price_cents * activePicked.length : 0
    const when = eventDate
      ? new Date(`${eventDate}T12:00:00`).toLocaleDateString(locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      : null
    return (
      <div className="mt-5 border-t border-white/[0.08] pt-5">
        {draftBadge}
        {header}

        <button
          type="button"
          onClick={() => openPicker(null)}
          className="group mt-3 block w-full rounded-2xl border border-white/10 bg-ink-950/50 p-2.5 text-left transition hover:border-flame-500/45 hover:bg-ink-950/70"
        >
          {stadiumPicture(true)}
          <span className="mt-2 flex items-center justify-between gap-2 px-1 pb-0.5">
            <span className="text-[13px] font-semibold text-white">{t('seat_choose_on_map')}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition group-hover:translate-x-0.5 group-hover:bg-flame-500 group-hover:text-white">
              <ChevronRight className="h-4 w-4" />
            </span>
          </span>
        </button>

        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {sale.categories.map((c, i) => {
            const gone = c.available <= 0
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => openPicker(c.code)}
                disabled={gone}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50 ${
                  i > 0 ? 'border-t border-white/[0.06]' : ''
                }`}
              >
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: gone ? 'rgba(255,255,255,0.25)' : colorFor(c.code) }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{c.label}</span>
                  <span className="block text-[11px] text-white/45">
                    {gone ? t('seat_sold_out') : fill(t('seat_left'), { n: c.available })}
                  </span>
                </span>
                <span className="text-sm font-semibold text-white">{money(c.price_cents)}</span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-white/30" />
              </button>
            )
          })}
        </div>

        {exact && selected && (
          <div className="mt-3 rounded-2xl border border-flame-500/30 bg-flame-500/[0.07] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-white">
                {t('seat_your_selection')} · {activePicked.length === 1 ? t('seat_one_seat') : fill(t('seat_n_seats'), { n: activePicked.length })}
              </span>
              <span className="text-base font-bold text-white">{money(total)}</span>
            </div>
            <p className="mt-1 text-xs text-white/55">
              {groupSeats(pickedSeats)
                .map((g) => `${t('seat_block')} ${g.block} · ${t('seat_row')} ${g.row} · ${t('seat_seats')} ${g.seats}`)
                .join(' | ')}
            </p>
          </div>
        )}

        {trust}
        {!pickerOpen && errorBox}
        <button type="button" onClick={() => openPicker(null)} className={`mt-4 ${PRIMARY}`}>
          <Armchair className="h-4 w-4" />
          {exact ? `${t('seat_continue')} · ${money(total)}` : t('seat_choose_cta')}
        </button>
        {!isAuthenticated && <p className="mt-2 text-center text-xs text-white/50">{t('seat_signin_hint')}</p>}
        {soldBy}

        {pickerOpen && (
          <SeatMapPicker
            onClose={closePicker}
            title={eventTitle}
            subtitle={[when, venueName].filter(Boolean).join(' · ') || null}
            sale={sale}
            map={venueMap}
            colorFor={colorFor}
            money={money}
            picked={activePicked}
            onPickedChange={(keys) => {
              setErrorKey(null)
              setPicked(keys)
            }}
            initialFilter={pickerFilter}
            onContinue={continueFromPicker}
            checkout={step === 'details' && exact ? checkout(true) : null}
            onBackFromCheckout={() => setStep('pick')}
            notice={errorKey && step === 'pick' ? t(errorKey) : null}
            busy={busy}
          />
        )}
      </div>
    )
  }

  // ---- no venue map: category + quantity -------------------------------------
  if (step === 'details' && selected) {
    return (
      <div className="mt-5 border-t border-white/[0.08] pt-5">
        {draftBadge}
        {checkout(false)}
      </div>
    )
  }

  const previewStrip = preview && (
    <div className="mt-3 rounded-2xl border border-flame-500/25 bg-flame-500/[0.06] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-white">
          {preview.area}
          {preview.block !== '-' ? ` · ${t('seat_block')} ${preview.block}` : ''} · {t('seat_row')} {preview.row}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
          {t('seat_best_available')}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {Array.from({ length: preview.runLen }, (_, i) => preview.runFirst + i).map((n) => {
          const mine = preview.seats.includes(n)
          return (
            <span
              key={n}
              className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border px-1 text-[11px] font-bold tabular-nums ${
                mine
                  ? 'border-flame-400 bg-flame-500 text-white shadow-glow-flame'
                  : 'border-white/15 bg-white/[0.03] text-white/40'
              }`}
            >
              {n}
            </span>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="mt-5 border-t border-white/[0.08] pt-5">
      {draftBadge}
      {header}
      {categoryList}
      {quantityRow}
      {previewStrip}
      {trust}
      {errorBox}
      <button
        type="button"
        onClick={startReserve}
        disabled={busy || !selected || selected.available <= 0}
        className={`mt-4 ${PRIMARY}`}
      >
        <Armchair className="h-4 w-4" />
        {selected ? fill(t('seat_reserve_cta'), { n: qty }) : t('seat_pick_category')}
      </button>
      {!isAuthenticated && (
        <p className="mt-2 text-center text-xs text-white/50">{t('seat_signin_hint')}</p>
      )}
      {soldBy}
    </div>
  )
}
