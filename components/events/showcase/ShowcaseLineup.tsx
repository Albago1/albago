'use client'

import { useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import {
  CalendarDays,
  Expand,
  Mic2,
  MapPin,
  Music2,
  Sparkles,
  Ticket,
  UsersRound,
  UtensilsCrossed,
} from 'lucide-react'
import PhotoLightbox from '@/components/events/PhotoLightbox'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { Language } from '@/lib/i18n/config'
import { isOwnImage } from '@/lib/ownImage'
import {
  formatEuro,
  formatShowcaseDate,
  type EventShowcase,
  type ShowcaseArtist,
  type ShowcaseRole,
} from '@/lib/eventShowcase'

/**
 * The showcase's main column: what kind of evening it is, who's on stage
 * (headliners as big photo cards, the band and the dance ensemble below),
 * and the official poster with a short ticket-stub recap beside it.
 */

type Copy = {
  evening: string
  highlights: Array<{ title: string; sub: (s: EventShowcase) => string }>
  onStage: string
  live: string
  roles: Record<ShowcaseRole, string>
  dance: string
  poster: string
  posterSub: string
  enlarge: string
  stubDate: string
  stubVenue: string
  stubEntry: string
  entryLine: (price: string, age: number) => string
}

const COPY: Record<Language, Copy> = {
  en: {
    evening: 'The evening',
    highlights: [
      { title: 'Family atmosphere', sub: (s) => `Kids ${s.admission.kidsFreeUpToAge} & under get in free` },
      { title: 'Menu & food', sub: () => 'A plate and a drink included' },
      { title: 'Live Albanian music', sub: (s) => (s.ensemble ? `Plus folk dance by ${s.ensemble}` : 'All night long') },
    ],
    onStage: 'On stage',
    live: 'Live',
    roles: { vocals: 'Vocals', clarinet: 'Clarinet', keyboard: 'Keyboard' },
    dance: 'Traditional dance',
    poster: 'The official poster',
    posterSub: 'Save it and send it to the family group.',
    enlarge: 'Enlarge poster',
    stubDate: 'When',
    stubVenue: 'Where',
    stubEntry: 'Entry',
    entryLine: (p, a) => `${p} per person · kids ${a} & under free`,
  },
  sq: {
    evening: 'Mbrëmja',
    highlights: [
      { title: 'Ambient familjar', sub: (s) => `Fëmijët deri ${s.admission.kidsFreeUpToAge} vjeç hyjnë falas` },
      { title: 'Me menu & ushqim', sub: () => 'Një pjatë dhe një pije të përfshira' },
      { title: 'Muzikë shqiptare live', sub: (s) => (s.ensemble ? `Dhe valle nga ${s.ensemble}` : 'Gjithë natën') },
    ],
    onStage: 'Në skenë',
    live: 'Live',
    roles: { vocals: 'Vokal', clarinet: 'Klarinetë', keyboard: 'Organo' },
    dance: 'Valle tradicionale',
    poster: 'Posteri zyrtar',
    posterSub: 'Ruaje dhe dërgoja grupit të familjes.',
    enlarge: 'Zmadho posterin',
    stubDate: 'Kur',
    stubVenue: 'Ku',
    stubEntry: 'Hyrja',
    entryLine: (p, a) => `${p} për person · fëmijët deri ${a} vjeç falas`,
  },
  de: {
    evening: 'Der Abend',
    highlights: [
      { title: 'Familiäre Atmosphäre', sub: (s) => `Kinder bis ${s.admission.kidsFreeUpToAge} Jahre haben freien Eintritt` },
      { title: 'Mit Menü & Essen', sub: () => 'Ein Teller und ein Getränk inklusive' },
      { title: 'Albanische Live-Musik', sub: (s) => (s.ensemble ? `Dazu Volkstanz von ${s.ensemble}` : 'Die ganze Nacht') },
    ],
    onStage: 'Auf der Bühne',
    live: 'Live',
    roles: { vocals: 'Gesang', clarinet: 'Klarinette', keyboard: 'Keyboard' },
    dance: 'Traditioneller Tanz',
    poster: 'Das offizielle Plakat',
    posterSub: 'Speichern und an die Familiengruppe schicken.',
    enlarge: 'Plakat vergrößern',
    stubDate: 'Wann',
    stubVenue: 'Wo',
    stubEntry: 'Eintritt',
    entryLine: (p, a) => `${p} pro Person · Kinder bis ${a} frei`,
  },
  es: {
    evening: 'La noche',
    highlights: [
      { title: 'Ambiente familiar', sub: (s) => `Niños hasta ${s.admission.kidsFreeUpToAge} años entran gratis` },
      { title: 'Con menú y comida', sub: () => 'Un plato y una bebida incluidos' },
      { title: 'Música albanesa en directo', sub: (s) => (s.ensemble ? `Y danza folclórica de ${s.ensemble}` : 'Toda la noche') },
    ],
    onStage: 'En el escenario',
    live: 'En directo',
    roles: { vocals: 'Voz', clarinet: 'Clarinete', keyboard: 'Teclado' },
    dance: 'Danza tradicional',
    poster: 'El cartel oficial',
    posterSub: 'Guárdalo y mándalo al grupo de la familia.',
    enlarge: 'Ampliar cartel',
    stubDate: 'Cuándo',
    stubVenue: 'Dónde',
    stubEntry: 'Entrada',
    entryLine: (p, a) => `${p} por persona · niños hasta ${a} gratis`,
  },
}

const HIGHLIGHT_ICONS = [UsersRound, UtensilsCrossed, Music2]

const noopSubscribe = () => () => {}
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

type Props = {
  showcase: EventShowcase
  date: string
  time: string
  /** "Altonaer Str. 77K, 13581 Berlin" — shown under the venue name. */
  address: string | null
  title: string
}

export default function ShowcaseLineup({ showcase, date, time, address, title }: Props) {
  const { language } = useLanguage()
  const hydrated = useHydrated()
  const lang: Language = hydrated ? language : 'en'
  const c = COPY[lang]
  const [posterOpen, setPosterOpen] = useState<number | null>(null)

  const dateLabel = formatShowcaseDate(date, lang, true)
  const price = formatEuro(showcase.admission.priceCents, lang === 'en' ? 'en-GB' : 'de-DE')

  return (
    <div className="mt-12 space-y-14">
      {/* The evening — three quick reasons to come */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          {c.evening}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {c.highlights.map((h, i) => {
            const Icon = HIGHLIGHT_ICONS[i] ?? Sparkles
            return (
              <div
                key={h.title}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-col sm:gap-4"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-flame-500/30 bg-flame-500/15 text-flame-300">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{h.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-white/55">{h.sub(showcase)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* On stage */}
      <section>
        <h2 className="display-text text-4xl leading-none tracking-tight text-white sm:text-5xl">
          {c.onStage}
        </h2>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
          {showcase.headliners.map((artist) => (
            <HeadlinerCard key={artist.name} artist={artist} live={c.live} />
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4">
          {showcase.band.map((artist) => (
            <div
              key={artist.name}
              className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3 pr-4"
            >
              <span className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-flame-500/40 ring-offset-2 ring-offset-transparent">
                {artist.photo ? (
                  <Image
                    src={artist.photo}
                    alt={artist.name}
                    fill
                    sizes="56px"
                    unoptimized={!isOwnImage(artist.photo)}
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-flame-500/15 text-flame-300">
                    <Music2 className="h-5 w-5" />
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">{artist.name}</p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-flame-300">
                  {c.roles[artist.role]}
                </p>
              </div>
            </div>
          ))}
        </div>

        {showcase.ensemble && (
          <div className="mt-3 flex items-center gap-3.5 rounded-2xl border border-white/10 bg-gradient-to-r from-flame-500/[0.10] to-white/[0.02] p-3 pr-4 sm:mt-4">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-flame-500/30 bg-flame-500/15 text-flame-300">
              <Sparkles className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-white">{showcase.ensemble}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-flame-300">
                {c.dance}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Official poster + ticket stub */}
      {showcase.poster && (
        <section className="grid items-center gap-6 sm:grid-cols-[minmax(0,260px)_1fr] sm:gap-8">
          <button
            type="button"
            onClick={() => setPosterOpen(0)}
            aria-label={c.enlarge}
            className="group relative mx-auto block aspect-[1290/1711] w-full max-w-[320px] overflow-hidden rounded-3xl border border-white/10 bg-ink-900 shadow-[0_30px_80px_-30px_rgba(238,28,37,0.55)] sm:max-w-none"
          >
            <Image
              src={showcase.poster}
              alt={title}
              fill
              sizes="(max-width: 640px) 320px, 260px"
              unoptimized={!isOwnImage(showcase.poster)}
              className="cursor-zoom-in object-cover transition duration-500 group-hover:scale-[1.03]"
            />
            <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md">
              <Expand className="h-4 w-4" />
            </span>
          </button>

          <div className="min-w-0">
            <h2 className="display-text text-3xl leading-tight tracking-tight text-white sm:text-4xl">
              {c.poster}
            </h2>
            <p className="mt-2 text-sm text-white/55">{c.posterSub}</p>

            <dl className="mt-5 divide-y divide-dashed divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
              <StubRow icon={<CalendarDays className="h-4 w-4" />} label={c.stubDate}>
                {dateLabel} · {time.slice(0, 5)}
              </StubRow>
              <StubRow icon={<MapPin className="h-4 w-4" />} label={c.stubVenue}>
                {showcase.venue}
                {address && <span className="block text-xs font-normal text-white/50">{address}</span>}
              </StubRow>
              <StubRow icon={<Ticket className="h-4 w-4" />} label={c.stubEntry}>
                {c.entryLine(price, showcase.admission.kidsFreeUpToAge)}
              </StubRow>
            </dl>
          </div>

          <PhotoLightbox
            photos={[showcase.poster]}
            activeIndex={posterOpen}
            onChange={setPosterOpen}
            alt={title}
          />
        </section>
      )}
    </div>
  )
}

function HeadlinerCard({ artist, live }: { artist: ShowcaseArtist; live: string }) {
  const [first, ...rest] = artist.name.split(' ')
  return (
    <figure className="group relative aspect-[3/4] overflow-hidden rounded-3xl border border-white/10 bg-ink-900 shadow-[0_24px_60px_-28px_rgba(238,28,37,0.6)]">
      {artist.photo && (
        <Image
          src={artist.photo}
          alt={artist.name}
          fill
          sizes="(max-width: 640px) 50vw, 320px"
          unoptimized={!isOwnImage(artist.photo)}
          className="object-cover transition duration-700 group-hover:scale-[1.04]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
      <figcaption className="on-media absolute inset-x-0 bottom-0 p-3.5 sm:p-5">
        <span className="inline-flex items-center gap-1 rounded-full bg-flame-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white sm:px-2.5 sm:py-1 sm:text-[10px]">
          <Mic2 className="h-3 w-3" />
          {live}
        </span>
        <p className="display-text mt-2 text-[1.7rem] leading-[0.95] tracking-tight text-white sm:text-4xl">
          {first}
          {rest.length > 0 && (
            <span className="block italic text-white/85">{rest.join(' ')}</span>
          )}
        </p>
      </figcaption>
    </figure>
  )
}

function StubRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 text-flame-300">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{label}</dt>
        <dd className="mt-0.5 text-sm font-semibold text-white">{children}</dd>
      </div>
    </div>
  )
}
