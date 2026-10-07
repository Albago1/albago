'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Check, ChevronRight, Minus, Plus, Sparkles, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { bestKeysInBlock, blockKey, parseSeatKey, pickSeats, seatKeyOf } from '@/lib/seats/pick'
import type { PublicSeat, PublicSeatSale } from '@/lib/seats/types'
import { allBlocks, type VenueMap } from '@/lib/seats/venueMaps'
import StadiumMap, { stockOnMap, type StockBlock } from './StadiumMap'

// Full-screen seat picker (phase 43), the way the big ticket shops do it:
//   1. the whole stadium — filter by price, pinch / scroll / tap to zoom
//   2. zoomed in, the blocks fill with their seats right on the map; tapping
//      a coloured block flies straight to its seats
//   3. tap seats; they collect in the selection (bottom sheet on phones,
//      sidebar on desktop) with the total — or let us pick the best ones
//   4. Continue → the checkout step renders inside the picker
// Selection state lives in the event-page panel, so it survives closing.

type Props = {
  onClose: () => void
  title: string
  subtitle: string | null
  sale: PublicSeatSale
  map: VenueMap
  colorFor: (category: string) => string
  money: (cents: number) => string
  /** Picked seat keys (still free). */
  picked: string[]
  onPickedChange: (keys: string[]) => void
  initialFilter: string | null
  onContinue: () => void
  /** Checkout step; shown instead of the map when set. */
  checkout: ReactNode | null
  onBackFromCheckout: () => void
  /** Error from the last reservation attempt (e.g. a seat just went). */
  notice: string | null
  busy: boolean
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))

const naturalCmp = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })

export default function SeatMapPicker({
  onClose,
  title,
  subtitle,
  sale,
  map,
  colorFor,
  money,
  picked,
  onPickedChange,
  initialFilter,
  onContinue,
  checkout,
  onBackFromCheckout,
  notice,
  busy,
}: Props) {
  const { t } = useLanguage()
  const [filter, setFilter] = useState<string | null>(initialFilter)
  // AlbaGo block the zoomed-in map is on (reported by the map).
  const [viewKey, setViewKey] = useState<string | null>(null)
  // Ask the map to fly to seats (best seats, a seat in the basket).
  const [fly, setFly] = useState<{ id: number; keys: string[] } | null>(null)
  const [quantity, setQuantity] = useState(2)
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)
  const [entered, setEntered] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const ready = useRef(false)

  const runs = useMemo(() => sale.runs ?? [], [sale.runs])
  const seats = useMemo(() => sale.seats ?? [], [sale.seats])
  const all = useMemo(() => allBlocks(map), [map])
  const stock = useMemo(() => stockOnMap(map, all, sale.blocks ?? [], runs), [map, all, sale.blocks, runs])
  const categories = sale.categories
  const catOf = (code: string) => categories.find((c) => c.code === code) ?? null

  const seatIndex = useMemo(() => new Map(seats.map((s) => [seatKeyOf(s), s])), [seats])
  const pickedSeats = picked
    .map((k) => seatIndex.get(k))
    .filter((s): s is PublicSeat => !!s)
    .sort((a, b) => naturalCmp(a.block, b.block) || naturalCmp(a.row, b.row) || a.seat - b.seat)
  const pickedCat = pickedSeats[0] ? catOf(pickedSeats[0].category) : null
  const pickedSet = useMemo(() => new Set(picked), [picked])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const k of picked) {
      const s = parseSeatKey(k)
      const key = blockKey(s)
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    return m
  }, [picked])

  const open = viewKey ? (stock.find((s) => blockKey(s.block) === viewKey) ?? null) : null
  const openCat = open ? catOf(open.block.category) : null

  // Slide in; lock the page behind; focus the close button.
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    const armed = window.setTimeout(() => {
      ready.current = true
    }, 450)
    const html = document.documentElement
    const before = html.style.overflow
    html.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      cancelAnimationFrame(id)
      window.clearTimeout(armed)
      html.style.overflow = before
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  const say = (text: string) => setToast((prev) => ({ text, id: (prev?.id ?? 0) + 1 }))

  // Escape steps back: checkout → map → closed.
  const escape = useRef(() => {})
  useEffect(() => {
    escape.current = () => {
      if (checkout) onBackFromCheckout()
      else onClose()
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') escape.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const flyTo = (keys: string[]) => setFly((prev) => ({ id: (prev?.id ?? 0) + 1, keys }))

  const sayOther = (text: string) => {
    if (ready.current) say(text)
  }

  const toggle = (seat: PublicSeat) => {
    const key = seatKeyOf(seat)
    if (pickedSet.has(key)) {
      onPickedChange(picked.filter((k) => k !== key))
    } else if (pickedCat && pickedCat.code !== seat.category) {
      onPickedChange([key])
      say(t('seat_switched'))
    } else if (picked.length >= sale.max_per_order) {
      say(t('seat_closeup_max'))
    } else {
      onPickedChange([...picked, key])
    }
  }

  const sellable = categories.filter((c) => c.available > 0)
  const bestPool = (filter ? sellable.filter((c) => c.code === filter) : [...sellable].sort((a, b) => b.price_cents - a.price_cents))
  const maxQty = Math.max(
    1,
    Math.min(
      sale.max_per_order,
      open ? (runs.filter((r) => r.area === open.block.area && r.block === open.block.block).reduce((m, r) => Math.max(m, r.len), 0) || 1)
        : Math.max(1, ...bestPool.map((c) => c.max_together)),
    ),
  )
  const qty = Math.min(Math.max(1, quantity), maxQty)

  const findBest = () => {
    if (open) {
      const keys = bestKeysInBlock(runs, open.block.category, qty, open.block)
      if (keys.length) {
        onPickedChange(keys)
        flyTo(keys)
      } else say(fill(t('seat_no_group'), { n: qty }))
      return
    }
    for (const c of bestPool) {
      const p = pickSeats(runs, c.code, qty)
      if (p) {
        const keys = p.seats.map((seat) => seatKeyOf({ area: p.area, block: p.block, row: p.row, seat }))
        onPickedChange(keys)
        flyTo(keys)
        return
      }
    }
    say(fill(t('seat_no_group'), { n: qty }))
  }

  const describe = (s: StockBlock) => {
    const c = catOf(s.block.category)
    return [
      `${t('seat_block')} ${s.shape.label ?? s.block.block}`,
      s.free > 0 ? fill(t('seat_free_n'), { n: s.free }) : t('seat_sold_out'),
      c && s.free > 0 ? money(c.price_cents) : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  const total = pickedCat ? pickedCat.price_cents * pickedSeats.length : 0
  const countLabel = (n: number) => (n === 1 ? t('seat_one_seat') : fill(t('seat_n_seats'), { n }))

  const chip = (active: boolean, disabled = false) =>
    `inline-flex h-9 flex-shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
      active ? 'border-white bg-white text-ink-950' : 'border-white/12 bg-white/[0.05] text-white/80 hover:border-white/30'
    } ${disabled ? 'line-through' : ''}`

  const stepper = (
    <div className="flex h-11 flex-shrink-0 items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-1">
      <button
        type="button"
        onClick={() => setQuantity(Math.max(1, qty - 1))}
        disabled={qty <= 1}
        aria-label="−1"
        className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-5 text-center text-sm font-bold tabular-nums text-white">{qty}</span>
      <button
        type="button"
        onClick={() => setQuantity(Math.min(maxQty, qty + 1))}
        disabled={qty >= maxQty}
        aria-label="+1"
        className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )

  const selection = (
    <div className="px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3.5 lg:flex lg:min-h-full lg:flex-col lg:p-6">
      {/* Desktop: price categories double as the filter */}
      <div className="hidden lg:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{t('seat_prices')}</p>
        <div className="mt-2.5 space-y-1.5">
          {categories.map((c) => {
            const active = filter === c.code
            const gone = c.available <= 0
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => setFilter(active ? null : c.code)}
                disabled={gone}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  active ? 'border-white/60 bg-white/[0.08]' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: gone ? 'rgba(255,255,255,0.2)' : colorFor(c.code) }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{c.label}</span>
                  <span className="block text-[11px] text-white/45">{gone ? t('seat_sold_out') : fill(t('seat_left'), { n: c.available })}</span>
                </span>
                <span className="text-sm font-bold text-white">{money(c.price_cents)}</span>
              </button>
            )
          })}
        </div>
        <div className="my-5 h-px bg-white/[0.08]" />
      </div>

      {notice && (
        <p role="alert" className="mb-3 rounded-2xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-100">
          {notice}
        </p>
      )}

      {pickedSeats.length === 0 ? (
        <div>
          {open && openCat ? (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(openCat.code) }} aria-hidden />
                {t('seat_block')} {open.shape.label ?? open.block.block}
                <span className="font-normal text-white/50">· {fill(t('seat_per_seat'), { price: money(openCat.price_cents) })}</span>
              </p>
              <p className="mt-1 text-xs text-white/50">
                {open.block.area} · {open.free > 0 ? fill(t('seat_free_n'), { n: open.free }) : t('seat_sold_out')}
              </p>
              <p className="mt-2 text-[13px] text-white/65">{t('seat_tap_seats')}</p>
            </>
          ) : (
            <p className="text-[13px] leading-snug text-white/65">{t('seat_tap_block')}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            {stepper}
            <button
              type="button"
              onClick={findBest}
              disabled={busy || (open ? open.free <= 0 : bestPool.length === 0)}
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-flame-500/45 bg-flame-500/12 px-4 text-sm font-semibold text-flame-50 transition hover:bg-flame-500/20 disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{fill(t(open ? 'seat_best_here' : 'seat_best_n'), { n: qty })}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="lg:flex lg:flex-1 lg:flex-col">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{t('seat_your_selection')}</p>
            <button
              type="button"
              onClick={() => onPickedChange([])}
              className="text-xs font-semibold text-white/55 underline-offset-2 transition hover:text-white hover:underline"
            >
              {t('seat_clear')}
            </button>
          </div>
          <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {pickedSeats.map((s) => (
              <span
                key={seatKeyOf(s)}
                className="inline-flex h-9 flex-shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] pl-3 pr-1 text-xs font-semibold text-white lg:h-11 lg:justify-between lg:rounded-xl"
              >
                <button
                  type="button"
                  onClick={() => flyTo([seatKeyOf(s)])}
                  className="inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(s.category) }} aria-hidden />
                  {t('seat_block')} {s.block} · {t('seat_row')} {s.row} · {t('seat_seat')} {s.seat}
                </button>
                <span className="flex items-center gap-1">
                  <span className="hidden text-white/55 lg:inline">{pickedCat ? money(pickedCat.price_cents) : ''}</span>
                  <button
                    type="button"
                    onClick={() => onPickedChange(picked.filter((k) => k !== seatKeyOf(s)))}
                    aria-label={t('seat_remove')}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </span>
            ))}
          </div>
          <div className="mt-3.5 flex items-center gap-3 lg:mt-auto lg:pt-5">
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold leading-tight text-white">{money(total)}</p>
              <p className="truncate text-[11px] text-white/50">
                {countLabel(pickedSeats.length)} × {pickedCat ? money(pickedCat.price_cents) : ''} · {pickedCat?.label}
              </p>
            </div>
            <button
              type="button"
              onClick={onContinue}
              disabled={busy}
              className="inline-flex h-12 flex-shrink-0 items-center gap-1.5 rounded-full bg-flame-500 pl-6 pr-4 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 disabled:opacity-45"
            >
              {t('seat_continue')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {sale.seller_name && (
        <p className="mt-3 hidden text-[11px] text-white/35 lg:block">{fill(t('seat_sold_by'), { name: sale.seller_name })}</p>
      )}
    </div>
  )

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('seat_choose_cta')}
      className={`fixed inset-0 z-[110] flex bg-black/70 backdrop-blur-sm transition-opacity duration-300 lg:p-6 ${entered ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className={`relative flex h-full w-full flex-col overflow-hidden bg-ink-950 transition-transform duration-300 ease-out lg:mx-auto lg:max-w-[1400px] lg:flex-row lg:rounded-3xl lg:border lg:border-white/10 lg:shadow-[0_30px_120px_-30px_rgba(0,0,0,0.9)] ${
          entered ? 'translate-y-0' : 'translate-y-6'
        }`}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-white/[0.08] px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] lg:px-5 lg:py-3.5">
            <button
              ref={closeRef}
              type="button"
              onClick={checkout ? onBackFromCheckout : onClose}
              aria-label={checkout ? t('seat_form_back') : t('seat_close')}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              {checkout ? <ArrowLeft className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white lg:text-base">{title}</p>
              {subtitle && <p className="truncate text-[11px] text-white/50 lg:text-xs">{subtitle}</p>}
            </div>
            {sale.seller_name && (
              <span className="hidden flex-shrink-0 rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45 sm:inline">
                {fill(t('seat_sold_by'), { name: sale.seller_name })}
              </span>
            )}
          </header>

          {checkout ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
              <div className="mx-auto max-w-lg">{checkout}</div>
            </div>
          ) : (
            <>
              {/* Price filter (phones; the desktop sidebar has the list) */}
              <div className="flex gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] lg:hidden">
                <button type="button" onClick={() => setFilter(null)} aria-pressed={!filter} className={chip(!filter)}>
                  {t('seat_all')}
                </button>
                {categories.map((c) => {
                  const active = filter === c.code
                  const gone = c.available <= 0
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setFilter(active ? null : c.code)}
                      disabled={gone}
                      aria-pressed={active}
                      className={chip(active, gone)}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(c.code) }} aria-hidden />
                      {c.label}
                      <span className={active ? 'text-ink-950/70' : 'text-white/55'}>{money(c.price_cents)}</span>
                    </button>
                  )
                })}
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(238,28,37,0.07),transparent_65%)]">
                <StadiumMap
                  map={map}
                  stock={stock}
                  seats={seats}
                  colorFor={colorFor}
                  filter={filter}
                  picked={pickedSet}
                  counts={counts}
                  fly={fly}
                  onToggleSeat={toggle}
                  onOther={sayOther}
                  onViewBlock={setViewKey}
                  disabled={busy}
                  labels={{
                    floor: t('seat_floor'),
                    ring: t('seat_ring'),
                    zoomIn: t('seat_zoom_in'),
                    zoomOut: t('seat_zoom_out'),
                    reset: t('seat_zoom_reset'),
                    legendOnSale: t('seat_legend_blocks'),
                    legendSoldOut: t('seat_sold_out'),
                    legendOther: t('seat_legend_not_here'),
                    legendFree: t('seat_legend_free'),
                    legendPicked: t('seat_legend_picked'),
                    legendTaken: t('seat_legend_taken'),
                    legendNotOnSale: t('seat_legend_other'),
                    block: t('seat_block'),
                    describe,
                    describeOther: (label) => `${t('seat_block')} ${label} · ${t('seat_legend_not_here')}`,
                    describeSeat: (seat, n) => {
                      const c = catOf(seat.category)
                      return [
                        `${t('seat_block')} ${seat.block}`,
                        `${t('seat_row')} ${seat.row}`,
                        `${t('seat_seat')} ${n}`,
                        seat.free ? (c ? money(c.price_cents) : null) : t('seat_taken'),
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    },
                  }}
                />

                {toast && (
                  <div
                    key={toast.id}
                    role="status"
                    className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-6"
                  >
                    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-ink-900/95 px-4 py-2 text-center text-xs font-semibold text-white shadow-xl backdrop-blur">
                      <Check className="h-3.5 w-3.5 flex-shrink-0 text-flame-300" />
                      {toast.text}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!checkout && (
          <aside className="flex-shrink-0 border-t border-white/[0.08] bg-ink-900/95 lg:w-[380px] lg:overflow-y-auto lg:border-l lg:border-t-0">
            {selection}
          </aside>
        )}
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
