'use client'

import { useSyncExternalStore } from 'react'
import { Baby, CupSoda, Phone, Snowflake, UtensilsCrossed } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { Language } from '@/lib/i18n/config'
import { asWaLang } from '@/lib/seats/whatsapp'
import { trackInteraction } from '@/lib/track'
import {
  OrganizerLogoTile,
  SOCIAL_PLATFORMS,
  showcaseSocials,
  type SocialLink,
} from '@/components/events/showcase/ShowcaseContact'
import { WhatsAppGlyph } from '@/components/icons/BrandGlyphs'
import {
  formatEuro,
  formatShowcaseDate,
  reservationWhatsAppHref,
  telHref,
  type EventShowcase,
} from '@/lib/eventShowcase'

/**
 * The ticket card: the price, what it includes, and — for now — simply
 * the organizer's contacts to reserve with: WhatsApp (a short reservation
 * request already written), phone, and their social pages.
 */

type Copy = {
  kicker: string
  perPerson: string
  meal: string
  drink: string
  included: string
  kids: (age: number) => string
  free: string
  reserveTitle: string
  reserveWa: string
  call: string
  note: (org: string) => string
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
    reserveTitle: 'Reserve with the organizer',
    reserveWa: 'Reserve on WhatsApp',
    call: 'Call',
    note: (o) => `Your reservation goes straight to the organizer, ${o}.`,
  },
  sq: {
    kicker: 'Darkë & show live',
    perPerson: 'për person',
    meal: '1 pjatë me ushqim',
    drink: '1 pije',
    included: 'Përfshirë',
    kids: (a) => `Fëmijët deri ${a} vjeç`,
    free: 'Hyrje falas',
    reserveTitle: 'Rezervo te organizatori',
    reserveWa: 'Rezervo në WhatsApp',
    call: 'Telefono',
    note: (o) => `Rezervimi shkon direkt te organizatori, ${o}.`,
  },
  de: {
    kicker: 'Dinner & Live-Show',
    perPerson: 'pro Person',
    meal: '1 Teller Essen',
    drink: '1 Getränk',
    included: 'Inklusive',
    kids: (a) => `Kinder bis ${a} Jahre`,
    free: 'Eintritt frei',
    reserveTitle: 'Beim Veranstalter reservieren',
    reserveWa: 'Per WhatsApp reservieren',
    call: 'Anrufen',
    note: (o) => `Deine Reservierung geht direkt an den Veranstalter, ${o}.`,
  },
  es: {
    kicker: 'Cena y show en directo',
    perPerson: 'por persona',
    meal: '1 plato de comida',
    drink: '1 bebida',
    included: 'Incluido',
    kids: (a) => `Niños hasta ${a} años`,
    free: 'Entrada gratis',
    reserveTitle: 'Reserva con el organizador',
    reserveWa: 'Reservar por WhatsApp',
    call: 'Llamar',
    note: (o) => `Tu reserva va directamente al organizador, ${o}.`,
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
  /** The organizer's social pages (from the event's organizer_socials). */
  socials: SocialLink[]
  city?: string | null
  country?: string | null
}

export default function ShowcaseReserve({ showcase, date, time, socials, city, country }: Props) {
  const { language } = useLanguage()
  const hydrated = useHydrated()
  // English on the server and first paint (no hydration mismatch); then the visitor's language.
  const lang: Language = hydrated ? language : 'en'
  const c = COPY[lang]

  const { priceCents, kidsFreeUpToAge, includes } = showcase.admission
  const each = formatEuro(priceCents, lang === 'en' ? 'en-GB' : 'de-DE')
  const when = `${formatShowcaseDate(date, asWaLang(lang))}, ${time.slice(0, 5)}`
  const waHref = reservationWhatsAppHref(showcase, asWaLang(lang), when)
  const known = showcaseSocials(socials)

  const track = (source: string) =>
    trackInteraction('outbound_click', {
      entityType: 'event',
      entityId: showcase.eventId,
      city,
      country,
      source,
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

      <p className="relative mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {c.reserveTitle}
      </p>
      <div className="relative mt-3 space-y-2.5">
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
        {known.length > 0 && (
          <div className={`grid gap-2.5 ${known.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {known.map(({ platform, href }) => {
              const { label, Glyph } = SOCIAL_PLATFORMS[platform]
              return (
                <a
                  key={platform}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track(`showcase_reserve_${platform}`)}
                  className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-white"
                >
                  <Glyph className="h-4 w-4 flex-shrink-0" />
                  {label}
                </a>
              )
            })}
          </div>
        )}
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
