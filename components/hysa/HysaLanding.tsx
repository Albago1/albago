import Link from 'next/link'
import { CalendarDays, Check, ChevronDown, MapPin, Navigation, TrainFront } from 'lucide-react'
import { HYSA_COPY } from '@/lib/hysa/copy'
import { CATEGORIES, FIGHTERS, HYSA_EVENT, hysaPath, type Fighter, type HysaLang } from '@/lib/hysa/event'
import { jsonLdScript, SITE_URL } from '@/lib/seo/jsonLd'
import {
  AvailabilityStatus,
  CategoryView,
  Countdown,
  LanguageSwitch,
  OfficialLink,
  PageView,
  ShareButtons,
  StickyTicketBar,
} from './HysaClient'
import HysaStadium from './HysaStadium'
import { hysaEventSchema } from '@/lib/hysa/metadata'

// Team Hysa landing page (phase 44) — server-rendered per language; the
// client islands in HysaClient handle tracking, countdown and sharing.
// Every ticket button deep-links into the official Nelson Hysa channel.

const CTA_PRIMARY =
  'inline-flex h-14 items-center justify-center gap-2 rounded-full bg-flame-500 px-7 text-[15px] font-bold tracking-wide text-white shadow-glow-flame transition hover:bg-flame-400'
const CTA_SECONDARY =
  'inline-flex h-14 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-7 text-[13px] font-bold tracking-wide text-white transition hover:border-white/40 hover:bg-white/[0.08]'
const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.24em] text-flame-300'
const H2 = 'mt-2 text-3xl font-black uppercase leading-[1.05] tracking-tight text-white sm:text-4xl'

function FighterCard({ fighter, lang, accent }: { fighter: Fighter; lang: HysaLang; accent: boolean }) {
  const c = HYSA_COPY[lang].why
  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 ${
        accent ? 'border-flame-500/50 bg-gradient-to-b from-flame-500/[0.16] to-transparent' : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <p className="text-3xl" aria-hidden>
        {fighter.flag}
      </p>
      <h3 className={`mt-2 text-2xl font-black uppercase tracking-tight ${accent ? 'text-white' : 'text-white/85'}`}>{fighter.name}</h3>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
        {c.countries[fighter.countryKey]}
        {fighter.hometown ? ` · ${fighter.hometown}` : ''}
      </p>
      {fighter.nickname && <p className="mt-1 text-sm italic text-white/60">“{fighter.nickname}”</p>}
      <p className="mt-3 text-sm text-white/70">{c.roles[fighter.roleKey]}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{c.record}</dt>
          <dd className="font-display text-3xl text-white">
            {fighter.wins}–{fighter.losses}
          </dd>
        </div>
        <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">KO</dt>
          <dd className="font-display text-3xl text-white">
            {fighter.kos} <span className="text-xs font-sans text-white/45">{c.ko}</span>
          </dd>
        </div>
      </dl>
    </div>
  )
}

export default function HysaLanding({ lang }: { lang: HysaLang }) {
  const c = HYSA_COPY[lang]
  const pageUrl = `${SITE_URL}${hysaPath(lang)}`
  const { venue } = HYSA_EVENT
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${venue.name}, ${venue.street}, ${venue.postalCode} ${venue.city}`)}`

  return (
    <main lang={lang} className="relative min-h-screen overflow-x-clip bg-ink-950 pb-28 text-white sm:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(hysaEventSchema(lang)) }} />
      <PageView lang={lang} />

      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link href="/" className="flex items-center gap-2" aria-label="AlbaGo">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-flame-500 shadow-glow-flame">
              <MapPin className="h-4 w-4 text-white" />
            </span>
            <span className="text-xl font-bold tracking-tight text-white">
              Alba<span className="font-display italic font-normal text-flame-500">Go</span>
            </span>
          </Link>
          <LanguageSwitch lang={lang} label={c.switchLabel} />
        </div>
      </header>

      {/* HERO */}
      <section className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden px-4 pb-10 pt-24 sm:justify-center sm:pb-16">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_20%_30%,rgba(238,28,37,0.38),transparent_60%),radial-gradient(ellipse_60%_50%_at_90%_80%,rgba(238,28,37,0.16),transparent_60%)]"
        />
        <div aria-hidden className="absolute -right-24 top-24 -z-10 h-[140%] w-40 rotate-[18deg] bg-flame-500/[0.07] blur-2xl" />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_auto]">
          <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-flame-500/40 bg-flame-500/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-flame-100">
            {c.hero.kicker}
          </p>
          <h1 className="mt-6">
            <span className="block text-[15px] font-bold uppercase tracking-[0.35em] text-white/70 sm:text-lg">Nelson</span>
            <span className="block text-[clamp(4.5rem,22vw,11rem)] font-black uppercase leading-[0.82] tracking-[-0.04em] text-white">
              Hysa
            </span>
            <span className="mt-3 flex items-baseline gap-3">
              <span className="font-display text-3xl italic text-flame-400 sm:text-4xl">{c.hero.vs}</span>
              <span className="text-2xl font-black uppercase tracking-tight text-white/55 sm:text-4xl">Agit Kabayel</span>
            </span>
          </h1>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-white/80">{c.hero.title}</p>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px] text-white/75">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-flame-300" />
              {c.hero.dateLine}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-flame-300" />
              {venue.name} · {venue.city}
            </span>
          </p>
          <div id="hero-ctas" className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#biletat" className={CTA_PRIMARY}>
              {c.hero.cta}
            </a>
            <a href="#sektoret" className={CTA_SECONDARY}>
              {c.hero.ctaSecondary}
            </a>
          </div>
          <div className="mt-8">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">{c.hero.countdownLabel}</p>
            <Countdown to={HYSA_EVENT.countdownTo} labels={c.hero.units} fightDay={c.hero.fightDay} />
          </div>
          </div>
          {/* Desktop: the date as a poster block */}
          <div aria-hidden className="hidden select-none text-right lg:block">
            <p className="font-display text-[13rem] italic leading-[0.8] text-transparent [-webkit-text-stroke:2px_rgba(238,28,37,0.85)]">28</p>
            <p className="mt-4 text-2xl font-black uppercase tracking-[0.2em] text-white">{c.hero.dateLine.replace(/^28.?s*/, '')}</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] text-white/50">{venue.city} · {HYSA_EVENT.broadcaster}</p>
          </div>
        </div>
        <a href="#team-hysa" aria-hidden tabIndex={-1} className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 text-white/30 sm:block">
          <ChevronDown className="h-6 w-6" />
        </a>
      </section>

      {/* TRUST */}
      <section className="border-y border-white/10 bg-white/[0.02] px-4 py-4">
        <ul className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:justify-center sm:gap-8">
          {c.trust.map((item) => (
            <li key={item} className="flex items-center gap-2 text-[13px] text-white/75">
              <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* TEAM HYSA MESSAGE */}
      <section id="team-hysa" className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">{c.support.heading}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/75">{c.support.body}</p>
          <ul className="mt-7 flex flex-wrap justify-center gap-2">
            {[c.support.chips.flag, c.support.chips.title, c.support.chips.place, c.support.chips.date].map((chip) => (
              <li key={chip} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80">
                {chip}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* TICKET FINDER */}
      <section id="biletat" className="scroll-mt-6 px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className={EYEBROW}>{c.tickets.eyebrow}</p>
          <h2 className={H2}>{c.tickets.heading}</h2>
          <p className="mt-3 max-w-2xl text-white/65">{c.tickets.intro}</p>
          <div className="mt-6">
            <AvailabilityStatus
              lang={lang}
              labels={{
                checking: c.tickets.availabilityChecking,
                official: c.tickets.availabilityOfficial,
                failed: c.tickets.availabilityFailed,
                checkOfficial: c.tickets.checkOfficial,
                live: c.tickets.liveLabel,
                updated: c.tickets.updated,
                stale: c.tickets.stale,
                status: c.tickets.status,
              }}
            />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {CATEGORIES.map((cat) => {
              const t = c.tickets.categories[cat.id]
              const recommended = cat.id === 'cat6'
              return (
                <CategoryView
                  key={cat.id}
                  lang={lang}
                  category={cat.id}
                  className={`flex flex-col rounded-3xl border p-5 sm:p-6 ${
                    recommended ? 'border-flame-500/60 bg-gradient-to-b from-flame-500/[0.14] to-white/[0.02]' : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full ring-2 ring-white/10" style={{ backgroundColor: cat.color }} aria-hidden />
                      <span className="text-2xl font-black tracking-tight text-white">{cat.name}</span>
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] ${
                        recommended ? 'bg-flame-500 text-white' : 'bg-white/[0.08] text-white/75'
                      }`}
                    >
                      {t.badge}
                    </span>
                  </div>
                  <dl className="mt-5 space-y-3 text-sm">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{c.tickets.area}</dt>
                      <dd className="mt-0.5 font-semibold text-white">{t.position}</dd>
                      <dd className="text-xs text-white/50">{cat.area}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{c.tickets.price}</dt>
                      <dd className="mt-0.5 text-white">
                        {cat.officialPrice
                          ? `€${(cat.officialPrice.cents / 100).toFixed(0)} · ${c.tickets.priceCheckedAt} ${cat.officialPrice.checkedAt}`
                          : c.tickets.priceOfficial}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{c.tickets.bestFor}</dt>
                      <dd className="mt-0.5 leading-snug text-white/75">{t.bestFor}</dd>
                    </div>
                  </dl>
                  <OfficialLink
                    type="ticket_category_click"
                    lang={lang}
                    category={cat.id}
                    placement="category_card"
                    className={`mt-6 ${recommended ? CTA_PRIMARY : CTA_SECONDARY} w-full`}
                  >
                    {c.tickets.cta}
                  </OfficialLink>
                </CategoryView>
              )
            })}
          </div>
          <p className="mt-5 flex items-start gap-2 text-sm text-white/60">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
            {c.tickets.purchaseNote}
          </p>
        </div>
      </section>

      {/* SEATING MAP */}
      <section id="sektoret" className="scroll-mt-6 bg-gradient-to-b from-transparent via-flame-500/[0.05] to-transparent px-4 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="order-2 rounded-3xl border border-white/10 bg-ink-950/60 p-3 sm:p-5 lg:order-1">
            <HysaStadium labels={{ floor: lang === 'sq' ? 'Parteri' : lang === 'de' ? 'Innenraum' : 'Floor', ring: 'Ring' }} />
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-[11px] text-white/65">
              <li className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CATEGORIES[1].color }} aria-hidden />
                {c.map.legendLower} · CAT 6
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CATEGORIES[0].color }} aria-hidden />
                {c.map.legendUpper} · CAT 8
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-white/25" aria-hidden />
                {c.map.legendFloor} · CAT 4
              </li>
            </ul>
            <p className="mt-2 px-1 text-[11px] text-white/40">{c.map.caption}</p>
          </div>
          <div className="order-1 lg:order-2">
            <p className={EYEBROW}>{c.map.eyebrow}</p>
            <h2 className={H2}>{c.map.heading}</h2>
            <p className="mt-4 text-white/70">{c.map.body}</p>
            <OfficialLink type="seat_map_click" lang={lang} placement="map_section" className={`mt-6 w-full sm:w-auto ${CTA_PRIMARY}`}>
              {c.map.cta}
            </OfficialLink>
            <p className="mt-3 text-xs text-white/45">{c.map.standNote}</p>
          </div>
        </div>
      </section>

      {/* WHY TEAM HYSA */}
      <section className="px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-3xl text-3xl font-black uppercase leading-[1.05] tracking-tight text-white sm:text-5xl">{c.why.heading}</h2>
          <p className="mt-4 max-w-2xl text-lg text-white/70">{c.why.body}</p>
          <div className="mt-8 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
            <FighterCard fighter={FIGHTERS.hysa} lang={lang} accent />
            <p className="text-center font-display text-4xl italic text-flame-400">{c.why.vs}</p>
            <FighterCard fighter={FIGHTERS.kabayel} lang={lang} accent={false} />
          </div>
          <p className="mt-4 text-[11px] text-white/40">{c.why.sourcesNote}</p>
        </div>
      </section>

      {/* SUPPORTERS + SHARE */}
      <section className="px-4 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(238,28,37,0.22),rgba(5,5,5,0.4)_55%)] p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{c.fans.heading}</h2>
            <p className="mt-3 text-white/75">{c.fans.body}</p>
            <ul className="mt-5 space-y-2">
              {c.fans.bring.map((item) => (
                <li key={item} className="text-[15px] text-white/85">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="self-end">
            <ShareButtons
              lang={lang}
              pageUrl={pageUrl}
              labels={{
                share: c.fans.share,
                shareText: c.fans.shareText,
                whatsapp: c.fans.whatsapp,
                facebook: c.fans.facebook,
                copy: c.fans.copy,
                copied: c.fans.copied,
              }}
            />
          </div>
        </div>
      </section>

      {/* GROUPS */}
      <section className="px-4 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">{c.group.heading}</h2>
            <p className="mt-2 text-white/70">{c.group.body}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {c.group.sizes.map((s) => (
                <li key={s} className="rounded-full border border-white/15 px-3.5 py-1.5 text-sm font-semibold text-white/85">
                  {s}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-white/45">{c.group.note}</p>
          </div>
          <OfficialLink type="group_ticket_click" lang={lang} placement="group_section" className={`mt-6 w-full sm:mt-0 sm:w-auto ${CTA_SECONDARY}`}>
            {c.group.cta}
          </OfficialLink>
        </div>
      </section>

      {/* TRAVEL */}
      <section className="px-4 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className={H2}>{c.travel.heading}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{c.travel.dateLabel}</p>
              <p className="mt-1 font-semibold text-white">{c.travel.date}</p>
              <p className="mt-2 text-xs text-white/50">{c.travel.timeNote}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{c.travel.addressLabel}</p>
              <p className="mt-1 font-semibold text-white">{venue.name}</p>
              <p className="text-sm text-white/70">
                {venue.street}, {venue.postalCode} {venue.city}
              </p>
              <a
                href={directions}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold text-white hover:bg-white/[0.06]"
              >
                <Navigation className="h-4 w-4" />
                {c.travel.directions}
              </a>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{c.travel.transportLabel}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/80">{c.travel.transport}</p>
              <a
                href="https://www.rheinbahn.de/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold text-white hover:bg-white/[0.06]"
              >
                <TrainFront className="h-4 w-4" />
                {c.travel.transit}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className={H2}>{c.faq.heading}</h2>
          <div className="mt-6 divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.02]">
            {c.faq.items.map((item) => (
              <details key={item.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-white">
                  {item.q}
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-white/50 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA + DISCLAIMER */}
      <section className="px-4 pb-16 pt-6">
        <div className="mx-auto max-w-3xl text-center">
          <OfficialLink type="official_shop_click" lang={lang} placement="footer_cta" className={`w-full sm:w-auto ${CTA_PRIMARY}`}>
            {c.hero.cta}
          </OfficialLink>
          <p className="mx-auto mt-6 max-w-2xl text-xs leading-relaxed text-white/45">{c.disclaimer}</p>
        </div>
      </section>

      <StickyTicketBar label={c.sticky} targetId="biletat" watchId="hero-ctas" />
    </main>
  )
}
