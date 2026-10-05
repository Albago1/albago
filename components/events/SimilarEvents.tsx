import Link from 'next/link'
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin } from 'lucide-react'
import type { SimilarEvent } from '@/lib/similarEvents'
import { getLocationBySlug } from '@/lib/locations'
import { displayPrice, formatPriceFrom } from '@/lib/ticketDisplay'
import { isMultiDay, isRecurring, nextOccurrence } from '@/lib/recurrence'
import { CATEGORY_ICONS } from './categoryMeta'

function categoryTone(category?: string) {
  const value = (category ?? '').toLowerCase()
  if (value === 'nightlife') return 'bg-fuchsia-500/20 text-fuchsia-200'
  if (value === 'music') return 'bg-violet-500/20 text-violet-200'
  if (value === 'sports') return 'bg-emerald-500/20 text-emerald-200'
  if (value === 'culture') return 'bg-sky-500/20 text-sky-200'
  if (value === 'food') return 'bg-amber-500/20 text-amber-200'
  return 'bg-white/15 text-white/85'
}

function cityLabel(slug: string): string {
  const known = getLocationBySlug(slug)
  if (known.slug === slug) return known.label
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function dateLabel(e: SimilarEvent): string {
  const base = nextOccurrence(e) ?? e.date
  if (isMultiDay(e) && e.end_date) {
    return `${shortDate(e.date)} – ${shortDate(e.end_date)}`
  }
  return isRecurring(e) ? `Next ${shortDate(base)}` : shortDate(base)
}

function priceLabel(e: SimilarEvent): string | null {
  if (e.price_from_cents != null) {
    return e.price_from_cents === 0
      ? 'Free'
      : `From ${formatPriceFrom(e.price_from_cents, e.price_currency)}`
  }
  return displayPrice(e.price)
}

// One line under "All {category} events" on the explore tile.
const CATEGORY_BLURBS: Record<string, string> = {
  nightlife: 'Clubs, parties and late nights across Albania and the diaspora',
  music: 'Concerts, DJs and live sets across Albania and the diaspora',
  culture: 'Theatre, comedy, art and talks across Albania and the diaspora',
  sports: 'Matches, races and outdoor events across Albania and the diaspora',
  food: 'Food festivals, tastings and markets across Albania and the diaspora',
}

const DOTS: Record<string, string> = {
  nightlife: 'bg-fuchsia-400',
  music: 'bg-violet-400',
  sports: 'bg-emerald-400',
  culture: 'bg-sky-400',
  food: 'bg-amber-400',
}

/** Compact poster row — used when there are only one or two matches, where a
 *  full card rail would leave a lonely card in a wide row. */
function SimilarRow({ e }: { e: SimilarEvent }) {
  const image = e.gallery_urls?.[0] || e.banner_url || null
  const category = (e.category ?? '').toLowerCase()
  return (
    <Link
      href={`/events/${e.slug}`}
      className="group flex items-center gap-4 rounded-[24px] bg-white/[0.03] p-3 pr-5 ring-1 ring-white/10 transition hover:bg-white/[0.06]"
    >
      <div className="relative aspect-[4/5] w-[88px] shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-grid opacity-30" />
            <div className="absolute inset-0 bg-radial-flame" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
          {dateLabel(e)}
          {e.time && (
            <>
              <span className="text-white/30"> · </span>
              <span className="text-flame-300">{e.time.slice(0, 5)}</span>
            </>
          )}
        </p>
        <h3 className="mt-1 line-clamp-2 font-display text-[22px] leading-[1.08] text-white">
          {e.title}
        </h3>
        <p className="mt-1.5 flex min-w-0 items-center gap-2 text-[13px] text-white/70">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[category] ?? 'bg-white/40'}`} />
          <span className="truncate capitalize">
            {e.category} <span className="text-white/35">·</span> {cityLabel(e.location_slug)}
          </span>
        </p>
      </div>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-white/40 transition group-hover:text-flame-300" />
    </Link>
  )
}

/** Fills the second half of a one-match row with a way to keep browsing —
 *  the whole category, every city (the header's "See all" stays local). */
function ExploreTile({ category }: { category: string }) {
  const key = category.toLowerCase()
  const href = key ? `/events?category=${encodeURIComponent(key)}` : '/events'
  const Icon = CATEGORY_ICONS[key] ?? CATEGORY_ICONS.all
  return (
    <Link
      href={href}
      className="group relative flex min-h-[200px] flex-col justify-between overflow-hidden rounded-[30px] bg-white/[0.03] p-7 ring-1 ring-white/10 transition hover:bg-white/[0.06]"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-flame-500/15 blur-3xl transition group-hover:bg-flame-500/25" />
      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-flame-500/15 ring-1 ring-flame-500/40">
        <Icon className="h-5 w-5 text-flame-300" />
      </span>
      <div className="relative">
        <p className="font-display text-[34px] capitalize leading-none text-white">
          All {key || 'similar'} events
        </p>
        <p className="mt-2 text-sm text-white/55">
          {CATEGORY_BLURBS[key] ?? 'More of what’s on across Albania and the diaspora'}
        </p>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-flame-300">
          Explore
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  )
}

export default function SimilarEvents({
  events,
  browseHref,
  category,
}: {
  events: SimilarEvent[]
  browseHref: string
  /** The current event's category — names the explore tile. */
  category: string
}) {
  if (events.length < 1) return null

  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <div className="flex items-end justify-between gap-4 border-t border-white/[0.06] pt-10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-flame-300/80">
            You might also like
          </p>
          <h2 className="display-text mt-1 text-3xl leading-tight tracking-tight sm:text-4xl">
            More events like this
          </h2>
        </div>
        <Link
          href={browseHref}
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white sm:inline-flex"
        >
          See all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {events.length <= 2 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {events.map((e) => (
            <SimilarRow key={e.id} e={e} />
          ))}
          {events.length === 1 && <ExploreTile category={category} />}
        </div>
      ) : (
      /* Horizontal snap rail — cards peek on mobile to signal scrollability,
          settle into a row on desktop. Scrollbar hidden for a native feel. */
      <div className="mt-6 -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {events.map((e) => {
          const image = e.gallery_urls?.[0] || e.banner_url || null
          const price = priceLabel(e)
          return (
            <Link
              key={e.id}
              href={`/events/${e.slug}`}
              className="group flex w-[78%] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-1 hover:border-flame-500/30 hover:bg-white/[0.06] hover:shadow-[0_20px_50px_-24px_rgba(238,28,37,0.55)] sm:w-[300px]"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-grid opacity-30" />
                    <div className="absolute inset-0 bg-radial-flame" />
                    <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame-500/20 blur-3xl" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-950/80 to-transparent" />
                <span
                  className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize backdrop-blur-sm ${categoryTone(
                    e.category,
                  )}`}
                >
                  {e.category}
                </span>
                {price && (
                  <span className="absolute bottom-3 right-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                    {price}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-2 text-base font-semibold leading-snug text-white transition group-hover:text-flame-100">
                  {e.title}
                </h3>
                <div className="mt-3 flex flex-col gap-1.5 text-xs text-white/55">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-flame-300/80" />
                    {dateLabel(e)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-flame-300/80" />
                    {cityLabel(e.location_slug)}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      )}
    </section>
  )
}
