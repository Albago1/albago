'use client'

import { useState, useSyncExternalStore } from 'react'
import {
  Baby,
  CupSoda,
  Minus,
  Phone,
  Plus,
  Snowflake,
  UtensilsCrossed,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { Language } from '@/lib/i18n/config'
import { asWaLang } from '@/lib/seats/whatsapp'
import { trackInteraction } from '@/lib/track'
import { OrganizerLogoTile } from '@/components/events/showcase/ShowcaseContact'
import { WhatsAppGlyph } from '@/components/icons/BrandGlyphs'
import {
  PARTY_LIMITS,
  formatEuro,
  formatShowcaseDate,
  partyTotalCents,
  reservationWhatsAppHref,
  telHref,
  type EventShowcase,
} from '@/lib/eventShowcase'

/**
 * "Reserve your table" — the price, what it includes, a little party
 * counter (paying guests + free kids) with the running total, and the
 * organizer's WhatsApp with the whole reservation already written.
 */

type Copy = {
  kicker: string
  perPerson: string
  meal: string
  drink: string
  included: string
  kids: (age: number) => string
  free: string
  yourTable: string
  adults: string
  adultsHint: (age: number) => string
  children: string
  childrenHint: (age: number) => string
  total: string
  breakdown: (adults: number, each: string, kids: number) => string
  reserveWa: string
  call: string
  note: (org: string) => string
  less: string
  more: string
}

const COPY: Record<Language, Copy> = {
  en: {
    kicker: 'Dinner & live show',
    perPerson: 'per person',
    meal: '1 plate of food',
    drink: '1 drink',
    included: 'Included',
    kids: (a) => `Kids ${a} & under`,
    free: 'Free entry',
    yourTable: 'Your table',
    adults: 'Guests',
    adultsHint: (a) => `Age ${a + 1}+`,
    children: 'Kids',
    childrenHint: (a) => `${a} & under · free`,
    total: 'Total',
    breakdown: (n, each, k) => `${n} × ${each}${k > 0 ? ` · ${k} ${k === 1 ? 'kid' : 'kids'} free` : ''}`,
    reserveWa: 'Reserve on WhatsApp',
    call: 'Call',
    note: (o) => `Your reservation goes straight to the organizer, ${o}.`,
    less: 'One less',
    more: 'One more',
  },
  sq: {
    kicker: 'Darkë & show live',
    perPerson: 'për person',
    meal: '1 pjatë me ushqim',
    drink: '1 pije',
    included: 'Përfshirë',
    kids: (a) => `Fëmijët deri ${a} vjeç`,
    free: 'Hyrje falas',
    yourTable: 'Tavolina jote',
    adults: 'Të ftuar',
    adultsHint: (a) => `Mbi ${a} vjeç`,
    children: 'Fëmijë',
    childrenHint: (a) => `deri ${a} vjeç · falas`,
    total: 'Totali',
    breakdown: (n, each, k) => `${n} × ${each}${k > 0 ? ` · ${k} fëmijë falas` : ''}`,
    reserveWa: 'Rezervo në WhatsApp',
    call: 'Telefono',
    note: (o) => `Rezervimi shkon direkt te organizatori, ${o}.`,
    less: 'Një më pak',
    more: 'Një më shumë',
  },
  de: {
    kicker: 'Dinner & Live-Show',
    perPerson: 'pro Person',
    meal: '1 Teller Essen',
    drink: '1 Getränk',
    included: 'Inklusive',
    kids: (a) => `Kinder bis ${a} Jahre`,
    free: 'Eintritt frei',
    yourTable: 'Dein Tisch',
    adults: 'Gäste',
    adultsHint: (a) => `Ab ${a + 1} Jahren`,
    children: 'Kinder',
    childrenHint: (a) => `bis ${a} Jahre · frei`,
    total: 'Gesamt',
    breakdown: (n, each, k) => `${n} × ${each}${k > 0 ? ` · ${k} ${k === 1 ? 'Kind' : 'Kinder'} frei` : ''}`,
    reserveWa: 'Per WhatsApp reservieren',
    call: 'Anrufen',
    note: (o) => `Deine Reservierung geht direkt an den Veranstalter, ${o}.`,
    less: 'Eine Person weniger',
    more: 'Eine Person mehr',
  },
  es: {
    kicker: 'Cena y show en directo',
    perPerson: 'por persona',
    meal: '1 plato de comida',
    drink: '1 bebida',
    included: 'Incluido',
    kids: (a) => `Niños hasta ${a} años`,
    free: 'Entrada gratis',
    yourTable: 'Tu mesa',
    adults: 'Invitados',
    adultsHint: (a) => `Desde ${a + 1} años`,
    children: 'Niños',
    childrenHint: (a) => `hasta ${a} años · gratis`,
    total: 'Total',
    breakdown: (n, each, k) => `${n} × ${each}${k > 0 ? ` · ${k} ${k === 1 ? 'niño' : 'niños'} gratis` : ''}`,
    reserveWa: 'Reservar por WhatsApp',
    call: 'Llamar',
    note: (o) => `Tu reserva va directamente al organizador, ${o}.`,
    less: 'Uno menos',
    more: 'Uno más',
  },
}

const noopSubscribe = () => () => {}
/** false on the server and the first paint, true after hydration — no effect needed. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

type Props = {
  showcase: EventShowcase
  /** Event date (YYYY-MM-DD) and start time (HH:MM[:SS]) for the message. */
  date: string
  time: string
  city?: string | null
  country?: string | null
}

export default function ShowcaseReserve({ showcase, date, time, city, country }: Props) {
  const { language } = useLanguage()
  const hydrated = useHydrated()
  // English on the server and first paint (no hydration mismatch); then the visitor's language.
  const lang: Language = hydrated ? language : 'en'
  const c = COPY[lang]
  const priceLocale = lang === 'en' ? 'en-GB' : 'de-DE'

  const [adults, setAdults] = useState(2)
  const [kids, setKids] = useState(0)

  const { priceCents, kidsFreeUpToAge, includes } = showcase.admission
  const each = formatEuro(priceCents, priceLocale)
  const total = formatEuro(partyTotalCents(priceCents, adults), priceLocale)

  const when = `${formatShowcaseDate(date, asWaLang(lang))}, ${time.slice(0, 5)}`
  const waHref = reservationWhatsAppHref(showcase, asWaLang(lang), when, adults, kids)

  const track = (source: string) =>
    trackInteraction('outbound_click', {
      entityType: 'event',
      entityId: showcase.eventId,
      city,
      country,
      source,
      meta: { adults, kids },
    })

  return (
    // overflow-clip, not -hidden: the glow pokes out, and a hidden box can
    // still be scrolled sideways by focus / scrollIntoView.
    <div className="relative mt-5 overflow-clip rounded-2xl border border-flame-500/30 bg-gradient-to-b from-flame-500/[0.14] via-white/[0.03] to-white/[0.02] p-5 lg:mt-7 lg:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-flame-500/25 blur-3xl"
      />

      <p className="relative inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-flame-300">
        <Snowflake className="h-3.5 w-3.5" />
        {c.kicker}
      </p>

      <div className="relative mt-3 flex items-end gap-3">
        <p className="font-display text-6xl leading-[0.85] tracking-tight text-white">{each}</p>
        <p className="pb-1 text-sm font-medium text-white/60">{c.perPerson}</p>
      </div>

      <ul className="relative mt-5 space-y-2">
        {includes.includes('meal') && (
          <IncludedRow icon={<UtensilsCrossed className="h-4 w-4" />} label={c.meal} badge={c.included} />
        )}
        {includes.includes('drink') && (
          <IncludedRow icon={<CupSoda className="h-4 w-4" />} label={c.drink} badge={c.included} />
        )}
        <IncludedRow
          icon={<Baby className="h-4 w-4" />}
          label={c.kids(kidsFreeUpToAge)}
          badge={c.free}
          strong
        />
      </ul>

      <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {c.yourTable}
        </p>
        <div className="mt-3 space-y-3">
          <Stepper
            label={c.adults}
            hint={c.adultsHint(kidsFreeUpToAge)}
            value={adults}
            min={PARTY_LIMITS.adultsMin}
            max={PARTY_LIMITS.adultsMax}
            onChange={setAdults}
            less={c.less}
            more={c.more}
          />
          <Stepper
            label={c.children}
            hint={c.childrenHint(kidsFreeUpToAge)}
            value={kids}
            min={PARTY_LIMITS.kidsMin}
            max={PARTY_LIMITS.kidsMax}
            onChange={setKids}
            less={c.less}
            more={c.more}
          />
        </div>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{c.total}</p>
            <p className="mt-0.5 text-xs tabular-nums text-white/50">
              {c.breakdown(adults, each, kids)}
            </p>
          </div>
          <p
            aria-live="polite"
            className="font-display text-4xl leading-none tabular-nums text-white"
          >
            {total}
          </p>
        </div>
      </div>

      <div className="relative mt-4 space-y-2.5">
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('showcase_whatsapp')}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-flame-400 to-flame-600 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(238,28,37,0.6)] ring-1 ring-inset ring-white/15 transition hover:-translate-y-0.5 hover:from-flame-300 hover:to-flame-500 hover:shadow-[0_16px_44px_-10px_rgba(238,28,37,0.78)]"
          >
            <WhatsAppGlyph className="h-[18px] w-[18px]" />
            {c.reserveWa}
          </a>
        )}
        <a
          href={telHref(showcase.reservationPhone)}
          onClick={() => track('showcase_call')}
          aria-label={`${c.call} ${showcase.reservationPhone}`}
          className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold tabular-nums text-white/85 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Phone className="h-4 w-4 flex-shrink-0" />
          {showcase.reservationPhone}
        </a>
      </div>

      <div className="relative mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
        <OrganizerLogoTile showcase={showcase} size="sm" />
        <p className="text-xs leading-snug text-white/55">{c.note(showcase.organizer)}</p>
      </div>
    </div>
  )
}

function IncludedRow({
  icon,
  label,
  badge,
  strong,
}: {
  icon: React.ReactNode
  label: string
  badge: string
  strong?: boolean
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-flame-500/30 bg-flame-500/15 text-flame-300">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-white/85">{label}</span>
      <span
        className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
          strong
            ? 'showcase-free-badge ring-1 ring-emerald-400/30'
            : 'bg-white/[0.06] text-white/60'
        }`}
      >
        {badge}
      </span>
    </li>
  )
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  less,
  more,
}: {
  label: string
  hint: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  less: string
  more: string
}) {
  const button =
    'flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white transition hover:border-flame-500/50 hover:bg-flame-500/15 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:bg-white/[0.05]'
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/50">{hint}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`${less} — ${label}`}
          className={button}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-7 text-center text-lg font-semibold tabular-nums text-white">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`${more} — ${label}`}
          className={button}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
