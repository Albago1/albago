'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { ArrowUpRight, Check, Expand, MousePointerClick, X } from 'lucide-react'
import { GuideMap, type BlockSide } from '@/components/seats/GuideMap'
import { allBlocks, venueMapById, type MapBlock } from '@/lib/seats/venueMaps'
import { sideOfBlock, type GuideSide, type OfficialSeatGuide } from '@/lib/seats/officialGuides'
import { trackInteraction } from '@/lib/track'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

/**
 * Interactive stadium guide for events sold only on the official shop.
 * First the face-off: whose side are you on? Then AlbaGo's own drawing of
 * the arena, split into the two sides — blocks with free seats in colour,
 * sold-out blocks black — and one tap to that side's official shop to pick
 * the exact seat and pay there. Availability is a dated, hand-entered
 * snapshot (`seen`), never read from the shop; prices are never shown.
 */

type Lang = 'en' | 'sq' | 'de' | 'es'
type Snapshot = { at: string; blocks: string[] }

/** ?map=1 in the URL = the full-screen map is open (Back closes it). */
const MAP_PARAM = 'map'

const COPY: Record<Lang, {
  title: string
  sub: (promoter: string) => string
  asOf: (when: string) => string
  live: string
  role: Record<GuideSide['role'], string>
  side: (s: GuideSide) => string
  rest: string
  ringside: string
  ringWhere: string
  tier: [string, string]
  blocksFree: (n: number) => string
  /** Short form for the fighter cards. */
  blocksShort: (n: number) => string
  sold: string
  expand: string
  zoom: { zoomIn: string; zoomOut: string; reset: string }
  block: (b: string) => string
  freeHere: (when: string) => string
  soldHere: (when: string) => string
  cta: string
  ctaRing: string
  check: string
  intro: (s: GuideSide) => string
  orTap: string
  hint: string
  shop: (s: GuideSide) => string
  note: (promoter: string) => string
  seenNote: string
  facts: [string, string]
  floor: string
  close: string
  months: string[]
}> = {
  en: {
    title: 'Pick your side',
    sub: (p) => `Choose your fighter's side, tap a block, then pick your exact seat on the official ${p} shop.`,
    asOf: (w) => `Seats as of ${w}`,
    live: 'Live seats on the official shop',
    role: { champion: 'WBC champion', challenger: 'Challenger' },
    side: (s) => `${s.name} side`,
    rest: 'Rest of the arena',
    ringside: 'Ringside',
    ringWhere: 'On the floor, around the ring — closest to the action.',
    tier: ['lower tier', 'upper tier'],
    blocksFree: (n) => (n === 1 ? '1 block with seats' : `${n} blocks with seats`),
    blocksShort: (n) => (n === 1 ? '1 block free' : `${n} blocks free`),
    sold: 'Sold out',
    expand: 'Full screen',
    zoom: { zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Show the whole arena' },
    block: (b) => `Block ${b}`,
    freeHere: (w) => `Seats free here on ${w}.`,
    soldHere: (w) => `Sold out on ${w} — returns happen, check live.`,
    cta: 'Choose your seat',
    ctaRing: 'Choose your ringside seat',
    check: 'Check live on the shop',
    intro: (s) => (s.stand ? `${s.name} fans sit together in the ${s.stand}.` : `${s.name} side: the rest of the arena.`),
    orTap: 'Or tap a coloured block on the map.',
    hint: 'Tap a fighter or a block to start',
    shop: (s) => `${s.name} side shop`,
    note: (p) => `Tickets are sold by ${p} on the official shop — prices and live availability are there. AlbaGo shows you the way.`,
    seenNote: 'Colours show the blocks we saw with free seats at that time; it changes fast.',
    facts: ['54,600-seat stadium', 'Ring in the centre'],
    floor: 'Floor',
    close: 'Close',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
  sq: {
    title: 'Zgjidh anën tënde',
    sub: (p) => `Zgjidh anën e boksierit tënd, prek një bllok, pastaj zgjidh vendin e saktë në shitoren zyrtare të ${p}.`,
    asOf: (w) => `Vendet më ${w}`,
    live: 'Vende live në shitoren zyrtare',
    role: { champion: 'Kampion WBC', challenger: 'Sfidues' },
    side: (s) => `Ana e ${s.sqGenitive ?? s.name}`,
    rest: 'Pjesa tjetër e arenës',
    ringside: 'Pranë ringut',
    ringWhere: 'Në parter, rreth ringut — sa më afër aksionit.',
    tier: ['kati i poshtëm', 'kati i sipërm'],
    blocksFree: (n) => (n === 1 ? '1 bllok me vende' : `${n} blloqe me vende`),
    blocksShort: (n) => (n === 1 ? '1 bllok i lirë' : `${n} blloqe të lira`),
    sold: 'Shitur',
    expand: 'Ekran i plotë',
    zoom: { zoomIn: 'Zmadho', zoomOut: 'Zvogëlo', reset: 'Shfaq gjithë arenën' },
    block: (b) => `Blloku ${b}`,
    freeHere: (w) => `Kishte vende të lira këtu më ${w}.`,
    soldHere: (w) => `Shitur më ${w} — ndonjëherë kthehen, kontrollo live.`,
    cta: 'Zgjidh vendin tënd',
    ctaRing: 'Zgjidh vendin pranë ringut',
    check: 'Kontrollo live në shitore',
    intro: (s) =>
      s.stand ? `Tifozët e ${s.sqGenitive ?? s.name} ulen bashkë në ${s.stand}.` : `Ana e ${s.sqGenitive ?? s.name}: pjesa tjetër e arenës.`,
    orTap: 'Ose prek një bllok me ngjyrë në hartë.',
    hint: 'Prek një boksier ose një bllok për të filluar',
    shop: (s) => `Shitorja — ana e ${s.sqGenitive ?? s.name}`,
    note: (p) => `Biletat i shet ${p} në shitoren zyrtare — çmimet dhe vendet e lira janë atje. AlbaGo të tregon rrugën.`,
    seenNote: 'Ngjyrat tregojnë blloqet ku pamë vende të lira në atë kohë; ndryshon shpejt.',
    facts: ['Stadium me 54.600 vende', 'Ringu në qendër'],
    floor: 'Parteri',
    close: 'Mbyll',
    months: ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'korr', 'gush', 'sht', 'tet', 'nën', 'dhj'],
  },
  de: {
    title: 'Wähle deine Seite',
    sub: (p) => `Wähle die Seite deines Boxers, tippe auf einen Block und such dir deinen genauen Platz im offiziellen ${p}-Shop aus.`,
    asOf: (w) => `Plätze, Stand ${w}`,
    live: 'Live-Plätze im offiziellen Shop',
    role: { champion: 'WBC-Weltmeister', challenger: 'Herausforderer' },
    side: (s) => `${s.name}-Seite`,
    rest: 'Restliche Arena',
    ringside: 'Ringside',
    ringWhere: 'Im Innenraum, rund um den Ring — am nächsten am Geschehen.',
    tier: ['Unterrang', 'Oberrang'],
    blocksFree: (n) => (n === 1 ? '1 Block mit Plätzen' : `${n} Blöcke mit Plätzen`),
    blocksShort: (n) => (n === 1 ? '1 Block frei' : `${n} Blöcke frei`),
    sold: 'Ausverkauft',
    expand: 'Vollbild',
    zoom: { zoomIn: 'Vergrößern', zoomOut: 'Verkleinern', reset: 'Ganze Arena zeigen' },
    block: (b) => `Block ${b}`,
    freeHere: (w) => `Hier waren am ${w} Plätze frei.`,
    soldHere: (w) => `Am ${w} ausverkauft — Rückläufer gibt es, live prüfen.`,
    cta: 'Platz wählen',
    ctaRing: 'Ringside-Platz wählen',
    check: 'Live im Shop prüfen',
    intro: (s) => (s.stand ? `Die ${s.name}-Fans sitzen gemeinsam auf der ${s.stand}.` : `${s.name}-Seite: die restliche Arena.`),
    orTap: 'Oder tippe auf einen farbigen Block.',
    hint: 'Tippe auf einen Boxer oder einen Block',
    shop: (s) => `Shop ${s.name}-Seite`,
    note: (p) => `Tickets verkauft ${p} im offiziellen Shop — Preise und Verfügbarkeit findest du dort. AlbaGo zeigt dir den Weg.`,
    seenNote: 'Die Farben zeigen die Blöcke, in denen wir zu diesem Zeitpunkt freie Plätze gesehen haben; das ändert sich schnell.',
    facts: ['Stadion mit 54.600 Plätzen', 'Ring in der Mitte'],
    floor: 'Innenraum',
    close: 'Schließen',
    months: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
  },
  es: {
    title: 'Elige tu lado',
    sub: (p) => `Elige el lado de tu boxeador, toca un bloque y elige tu asiento exacto en la tienda oficial de ${p}.`,
    asOf: (w) => `Asientos a ${w}`,
    live: 'Asientos en vivo en la tienda oficial',
    role: { champion: 'Campeón WBC', challenger: 'Aspirante' },
    side: (s) => `Lado de ${s.name}`,
    rest: 'Resto del estadio',
    ringside: 'Ringside',
    ringWhere: 'En la pista, alrededor del ring — lo más cerca de la acción.',
    tier: ['grada baja', 'grada alta'],
    blocksFree: (n) => (n === 1 ? '1 bloque con asientos' : `${n} bloques con asientos`),
    blocksShort: (n) => (n === 1 ? '1 bloque libre' : `${n} bloques libres`),
    sold: 'Agotado',
    expand: 'Pantalla completa',
    zoom: { zoomIn: 'Acercar', zoomOut: 'Alejar', reset: 'Ver todo el estadio' },
    block: (b) => `Bloque ${b}`,
    freeHere: (w) => `Había asientos libres aquí el ${w}.`,
    soldHere: (w) => `Agotado el ${w} — a veces vuelven, compruébalo en vivo.`,
    cta: 'Elige tu asiento',
    ctaRing: 'Elige tu asiento junto al ring',
    check: 'Comprobar en vivo en la tienda',
    intro: (s) => (s.stand ? `La afición de ${s.name} se sienta junta en la ${s.stand}.` : `Lado de ${s.name}: el resto del estadio.`),
    orTap: 'O toca un bloque de color en el mapa.',
    hint: 'Toca un boxeador o un bloque para empezar',
    shop: (s) => `Tienda — lado de ${s.name}`,
    note: (p) => `Las entradas las vende ${p} en la tienda oficial — precios y disponibilidad están allí. AlbaGo te muestra el camino.`,
    seenNote: 'Los colores muestran los bloques donde vimos asientos libres en ese momento; cambia rápido.',
    facts: ['Estadio de 54.600 plazas', 'Ring en el centro'],
    floor: 'Pista',
    close: 'Cerrar',
    months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
  },
}

/** "23 Oct, 19:47" from the snapshot's own wall-clock time — the same on server and client. */
function whenLabel(iso: string, lang: Lang): string {
  const m = /^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return ''
  const day = Number(m[2])
  return `${day}${lang === 'de' ? '.' : ''} ${COPY[lang].months[Number(m[1]) - 1]}, ${m[3]}:${m[4]}`
}

/** A side-coloured button fill: lighter at the top, like the flame CTA. */
const ctaStyle = (color: string) => ({
  backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${color} 72%, white), ${color})`,
  boxShadow: `0 10px 30px -8px color-mix(in srgb, ${color} 65%, transparent)`,
})

export default function StadiumGuide({ eventId, guide, seen }: { eventId: string; guide: OfficialSeatGuide; seen: Snapshot | null }) {
  const { language } = useLanguage()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // Render English on the server and first paint (no hydration mismatch), then localize.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])
  const lang: Lang = mounted && (language === 'sq' || language === 'de' || language === 'es') ? language : 'en'
  const c = COPY[lang]
  const when = seen ? whenLabel(seen.at, lang) : ''

  const map = venueMapById(guide.venueMapId)
  const free = useMemo(() => (seen ? new Set(seen.blocks) : null), [seen])
  // Free blocks per side, for the face-off cards.
  const freeCount = useMemo(() => {
    if (!map || !free) return null
    const n = [0, 0]
    for (const b of allBlocks(map)) {
      const s = sideOfBlock(guide, b)
      if ((s === 0 || s === 1) && free.has(b.label!)) n[s]++
    }
    return n
  }, [map, free, guide])

  const [focus, setFocus] = useState<0 | 1 | null>(null)
  const [picked, setPicked] = useState<{ b: MapBlock; side: BlockSide } | null>(null)

  // Full-screen map, in step with the browser's Back button (?map=1).
  const [full, setFull] = useState(false)
  const pushed = useRef(false)
  const openFull = () => {
    const url = new URL(window.location.href)
    url.searchParams.set(MAP_PARAM, '1')
    window.history.pushState(null, '', url)
    pushed.current = true
    setFull(true)
  }
  const closeFull = useCallback(() => {
    setFull(false)
    if (pushed.current) {
      pushed.current = false
      window.history.back()
    }
  }, [])
  useEffect(() => {
    // A reload while open leaves ?map=1 behind; start closed and drop it.
    const url = new URL(window.location.href)
    if (url.searchParams.has(MAP_PARAM)) {
      url.searchParams.delete(MAP_PARAM)
      window.history.replaceState(null, '', url)
    }
    const onPop = () => {
      if (!new URLSearchParams(window.location.search).has(MAP_PARAM)) {
        pushed.current = false
        setFull(false)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // While open: the page behind stays put, Escape closes.
  useEffect(() => {
    if (!full) return
    const html = document.documentElement
    const before = html.style.overflow
    html.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFull()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      html.style.overflow = before
      window.removeEventListener('keydown', onKey)
    }
  }, [full, closeFull])

  const sideName = useCallback((s: BlockSide) => (s === 'ring' ? c.ringside : c.side(guide.sides[s])), [c, guide.sides])
  const describe = useCallback(
    (b: MapBlock, s: BlockSide) => {
      const status = free ? (free.has(b.label!) ? ` · ✓` : ` · ${c.sold}`) : ''
      return `${c.block(b.label!)} · ${sideName(s)}${status}`
    },
    [c, free, sideName],
  )
  const onBlock = useCallback(
    (b: MapBlock, s: BlockSide) => {
      setPicked({ b, side: s })
      trackInteraction('seat_map_click', {
        entityType: 'event',
        entityId: eventId,
        source: 'stadium_guide',
        meta: { side: s === 'ring' ? 'ring' : guide.sides[s].key, block: b.label, free: free ? free.has(b.label!) : null },
      })
    },
    [eventId, free, guide.sides],
  )

  if (!map) return null

  const shopOf = (s: BlockSide) => (s === 'ring' ? guide.ringside.shop : guide.sides[s].shop)
  const openShop = (s: BlockSide | 'all', block?: string | null) =>
    trackInteraction('official_shop_click', {
      entityType: 'event',
      entityId: eventId,
      source: 'stadium_guide',
      meta: { side: s === 'ring' || s === 'all' ? s : guide.sides[s].key, block: block ?? null, free: block && free ? free.has(block) : null },
    })
  const chooseSide = (i: 0 | 1) => {
    setFocus(focus === i ? null : i)
    setPicked(null)
  }

  const pickedFree = picked && free ? free.has(picked.b.label!) : null
  const pickedColor = picked ? (picked.side === 'ring' ? guide.ringside.color : guide.sides[picked.side].color) : null

  const mapProps = {
    map,
    guide,
    free,
    focus,
    activeLabel: picked?.b.label ?? null,
    labels: { floor: c.floor, ring: 'Ring', title: c.title },
    describe,
    onBlock,
  }

  const legend = (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] font-semibold text-white/70">
      {guide.sides.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} />
          {c.side(s)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: guide.ringside.color }} />
        {c.ringside}
      </span>
      {seen && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-white/25 bg-[#08080b]" />
          {c.sold}
        </span>
      )}
    </div>
  )

  // The block or side in focus, with its official shop — inline and full screen.
  const detail =
    picked && pickedColor ? (
      <div className="rounded-2xl border border-white/10 bg-ink-950/60 p-4" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-white">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: pickedColor }} />
              {c.block(picked.b.label!)}
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ backgroundColor: `color-mix(in srgb, ${pickedColor} 18%, transparent)`, color: `color-mix(in srgb, ${pickedColor} 55%, white)` }}
              >
                {picked.side === 'ring' ? c.ringside : `${guide.sides[picked.side].flag} ${c.side(guide.sides[picked.side])}`}
              </span>
            </p>
            <p className="mt-1 text-sm text-white/60">
              {picked.side === 'ring' ? c.ringWhere : `${guide.sides[picked.side].stand ?? c.rest} · ${c.tier[picked.b.tier] ?? ''}`}
            </p>
            {pickedFree !== null && (
              <p className={`mt-1.5 flex items-start gap-1.5 text-xs font-medium ${pickedFree ? 'text-emerald-200' : 'text-white/50'}`}>
                {pickedFree ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" strokeWidth={3} />
                ) : (
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px] border border-white/25 bg-[#08080b]" />
                )}
                {pickedFree ? c.freeHere(when) : c.soldHere(when)}
              </p>
            )}
          </div>
          <button type="button" onClick={() => setPicked(null)} aria-label={c.close} className="rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <a
          href={shopOf(picked.side)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => openShop(picked.side, picked.b.label)}
          className={
            pickedFree === false
              ? 'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]'
              : `mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold ring-1 ring-inset ring-white/15 transition hover:-translate-y-0.5 ${picked.side === 'ring' ? 'text-ink-950' : 'text-white'}`
          }
          style={pickedFree === false ? undefined : ctaStyle(pickedColor)}
        >
          {picked.side === 'ring' ? c.ctaRing : pickedFree === false ? c.check : c.cta}
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    ) : focus !== null ? (
      <div className="rounded-2xl border border-white/10 bg-ink-950/60 p-4" aria-live="polite">
        <p className="flex items-center gap-2 text-base font-semibold text-white">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: guide.sides[focus].color }} />
          {guide.sides[focus].flag} {c.side(guide.sides[focus])}
        </p>
        <p className="mt-1 text-sm text-white/60">
          {c.intro(guide.sides[focus])}
          {freeCount && ` ${freeCount[focus] > 0 ? c.blocksFree(freeCount[focus]) : c.sold} · ${when}.`}
        </p>
        <a
          href={guide.sides[focus].shop}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => openShop(focus)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:-translate-y-0.5"
          style={ctaStyle(guide.sides[focus].color)}
        >
          {c.cta}
          <ArrowUpRight className="h-4 w-4" />
        </a>
        <p className="mt-2 text-center text-xs text-white/45">{c.orTap}</p>
      </div>
    ) : (
      <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/55">
        <MousePointerClick className="h-4 w-4 text-flame-300" />
        {c.hint}
      </p>
    )

  return (
    <section
      aria-labelledby="stadium-guide-title"
      className="-mx-3 mb-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] sm:mx-0"
    >
      <div className="px-4 pt-5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 id="stadium-guide-title" className="whitespace-nowrap font-display text-2xl leading-none text-white">
            {c.title}
          </h2>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {seen ? c.asOf(when) : c.live}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{c.sub(guide.promoter)}</p>

        {/* Face-off: whose side are you on? */}
        <div className="relative mt-4 grid grid-cols-2 gap-2">
          {guide.sides.map((s, i) => {
            const on = focus === i
            const off = focus !== null && !on
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => chooseSide(i as 0 | 1)}
                className={`group relative h-52 overflow-hidden rounded-2xl border text-left transition duration-300 sm:h-60 ${on ? 'border-white/60' : 'border-white/10 hover:border-white/30'} ${off ? 'opacity-45 saturate-50' : ''}`}
                style={on ? { boxShadow: `0 0 0 1px ${s.color}, 0 18px 40px -12px ${s.color}` } : undefined}
              >
                {s.photo && (
                  <Image
                    src={s.photo}
                    alt={s.fullName}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 50vw, 320px"
                    className="object-cover object-[50%_18%] transition duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${s.color} 0%, color-mix(in srgb, ${s.color} 45%, transparent) 38%, transparent 72%)` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />
                <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/75">{c.role[s.role]}</p>
                  <p className="mt-0.5 font-display text-[1.6rem] leading-none text-white">
                    <span className="mr-1 text-xl">{s.flag}</span>
                    {s.name}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-white/80">{s.record}</p>
                  <p className="mt-2 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                    {freeCount ? (freeCount[i] > 0 ? c.blocksShort(freeCount[i]) : c.sold) : (s.stand ?? c.rest)}
                  </p>
                </div>
                {on && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink-950">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
          <span className="pointer-events-none absolute left-1/2 top-[34%] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-ink-950 font-display text-base text-white shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            VS
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">{legend}</div>
          <button
            type="button"
            onClick={openFull}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
          >
            <Expand className="h-3.5 w-3.5" />
            {c.expand}
          </button>
        </div>
      </div>

      {/* The arena — a picture inline (the page scrolls over it); full screen to zoom in */}
      <div className="mt-2 px-1">
        <GuideMap {...mapProps} />
      </div>

      <div className="px-4 pb-5 pt-3 sm:px-5">
        {detail}

        {/* Facts + both sides' official shops */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/45">
          <span>{c.facts[0]}</span>
          <span>{c.facts[1]}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {guide.sides.map((s, i) => (
            <a
              key={s.key}
              href={s.shop}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => openShop(i as 0 | 1)}
              aria-label={c.shop(s)}
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/[0.06]"
              style={{ borderColor: `color-mix(in srgb, ${s.color} 55%, transparent)`, backgroundColor: `color-mix(in srgb, ${s.color} 10%, transparent)` }}
            >
              {s.flag} {c.side(s)}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          {c.note(guide.promoter)}
          {seen && ` ${c.seenNote}`}
        </p>
      </div>

      {/* Full screen: the same map with pinch / drag / wheel zoom */}
      {full &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label={c.title} className="fixed inset-0 z-[110] flex flex-col bg-ink-950">
            <div className="flex flex-shrink-0 items-center gap-2 border-b border-white/10 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={closeFull}
                aria-label={c.close}
                autoFocus
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="min-w-0 truncate font-display text-xl text-white">{c.title}</p>
              <div className="ml-auto flex gap-1.5">
                {guide.sides.map((s, i) => {
                  const on = focus === i
                  return (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => chooseSide(i as 0 | 1)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition ${on ? 'text-white' : 'border-white/15 text-white/70 hover:text-white'}`}
                      style={on ? { borderColor: s.color, backgroundColor: `color-mix(in srgb, ${s.color} 25%, transparent)` } : undefined}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04),transparent_65%)]">
              <GuideMap {...mapProps} zoomable={c.zoom} />
            </div>
            <div className="flex-shrink-0 border-t border-white/10 bg-ink-950/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <div className="mb-3">{legend}</div>
              {/* Steady height, so the map above doesn't resize (and lose its framing) as the card changes */}
              <div className="flex min-h-[12.5rem] flex-col justify-center">{detail}</div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  )
}
