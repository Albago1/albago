'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Check, MapPin, MousePointerClick, X } from 'lucide-react'
import { StadiumArt, type StockBlock } from '@/components/seats/StadiumMap'
import { allBlocks, venueMapById, type MapBlock } from '@/lib/seats/venueMaps'
import { blockKey } from '@/lib/seats/pick'
import { SEEN_MAX_DAYS, type OfficialSeatGuide } from '@/lib/seats/officialGuides'
import { trackInteraction } from '@/lib/track'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

/**
 * Interactive stadium guide for events sold only on the official shop.
 * AlbaGo's own drawing of the venue: tap a block to see where it is, then
 * continue to the official seat map to pick the exact seat and pay there.
 * No prices are shown here, and availability only as a dated, hand-entered
 * snapshot ("seen free") — the official shop is the source of truth (and
 * AlbaGo never reads it).
 */

type Zone = 'fan_lower' | 'fan_upper' | 'floor' | 'stands'
type Lang = 'en' | 'sq' | 'de' | 'es'

const ZONE_COLOR: Record<Zone, string> = {
  fan_lower: '#ee1c25',
  fan_upper: '#f87171',
  floor: '#e5e7eb',
  stands: '#64748b',
}
const SEEN_COLOR = '#4ade80'
const LOCALE: Record<Lang, string> = { en: 'en-GB', sq: 'sq-AL', de: 'de-DE', es: 'es-ES' }

const COPY: Record<Lang, {
  title: string
  sub: (promoter: string) => string
  live: string
  zone: Record<Zone, (fighter: string) => string>
  where: Record<Zone, (stand: string, fighter: string) => string>
  block: (b: string) => string
  ctaFans: (fighter: string) => string
  ctaMain: string
  allAreas: (promoter: string) => string
  fansShop: (fighter: string) => string
  hint: string
  note: (promoter: string) => string
  facts: [string, string, (stand: string, fighter: string) => string]
  floor: string
  close: string
  seen: (when: string) => string
  seenTag: string
  seenHere: (when: string) => string
  seenNote: string
}> = {
  en: {
    title: 'Pick your spot',
    sub: (p) => `Tap any block to see where it is — then choose your exact seat on the official ${p} shop.`,
    live: 'Live seats on the official shop',
    zone: { fan_lower: (f) => `${f} fans · lower tier`, fan_upper: (f) => `${f} fans · upper tier`, floor: () => 'Floor, around the ring', stands: () => 'Other stands' },
    where: {
      fan_lower: (s, f) => `${s}, lower tier — the ${f} fan section.`,
      fan_upper: (s, f) => `${s}, upper tier — the ${f} fan section.`,
      floor: () => 'On the floor, around the ring — closest to the action.',
      stands: () => 'In the other stands of the arena.',
    },
    block: (b) => `Block ${b}`,
    ctaFans: (f) => `Choose your seat — ${f} fan section`,
    ctaMain: 'Choose your seat on the official shop',
    allAreas: (p) => `All areas · official ${p} shop`,
    fansShop: (f) => `${f} fan section`,
    hint: 'Tap a block on the map',
    note: (p) => `Tickets are sold by ${p} on the official shop — prices and live availability are there. AlbaGo shows you the way.`,
    facts: ['54,600-seat stadium', 'Ring in the centre', (s, f) => `${s} = ${f} fans`],
    floor: 'Floor',
    close: 'Close',
    seen: (w) => `Seats seen free · ${w}`,
    seenTag: 'seats seen free',
    seenHere: (w) => `Seats were free here on ${w} — check live on the shop.`,
    seenNote: 'Green = seats we saw free on the official shop at that time. It changes fast — the shop is live.',
  },
  sq: {
    title: 'Zgjidh vendin tënd',
    sub: (p) => `Prek çdo bllok për të parë ku ndodhet — pastaj zgjidh vendin e saktë në shitoren zyrtare të ${p}.`,
    live: 'Vende live në shitoren zyrtare',
    zone: { fan_lower: (f) => `Tifozët e ${f} · kati i poshtëm`, fan_upper: (f) => `Tifozët e ${f} · kati i sipërm`, floor: () => 'Parteri, rreth ringut', stands: () => 'Tribunat e tjera' },
    where: {
      fan_lower: (s, f) => `${s}, kati i poshtëm — sektori i tifozëve të ${f}.`,
      fan_upper: (s, f) => `${s}, kati i sipërm — sektori i tifozëve të ${f}.`,
      floor: () => 'Në parter, rreth ringut — sa më afër aksionit.',
      stands: () => 'Në tribunat e tjera të arenës.',
    },
    block: (b) => `Blloku ${b}`,
    ctaFans: (f) => `Zgjidh vendin — sektori i ${f}`,
    ctaMain: 'Zgjidh vendin në shitoren zyrtare',
    allAreas: (p) => `Të gjitha zonat · shitorja zyrtare ${p}`,
    fansShop: (f) => `Sektori i ${f}`,
    hint: 'Prek një bllok në hartë',
    note: (p) => `Biletat i shet ${p} në shitoren zyrtare — çmimet dhe vendet e lira janë atje. AlbaGo të tregon rrugën.`,
    facts: ['Stadium me 54.600 vende', 'Ringu në qendër', (s, f) => `${s} = tifozët e ${f}`],
    floor: 'Parteri',
    close: 'Mbyll',
    seen: (w) => `Vende të lira · ${w}`,
    seenTag: 'vende të lira',
    seenHere: (w) => `Kishte vende të lira këtu më ${w} — kontrollo live në shitore.`,
    seenNote: 'E gjelbër = vende që i pamë të lira në shitoren zyrtare në atë kohë. Ndryshojnë shpejt — shitorja është live.',
  },
  de: {
    title: 'Finde deinen Platz',
    sub: (p) => `Tippe auf einen Block, um zu sehen, wo er liegt — und wähle deinen genauen Platz im offiziellen ${p}-Shop.`,
    live: 'Live-Plätze im offiziellen Shop',
    zone: { fan_lower: (f) => `${f}-Fans · Unterrang`, fan_upper: (f) => `${f}-Fans · Oberrang`, floor: () => 'Innenraum, rund um den Ring', stands: () => 'Weitere Tribünen' },
    where: {
      fan_lower: (s, f) => `${s}, Unterrang — der ${f}-Fanblock.`,
      fan_upper: (s, f) => `${s}, Oberrang — der ${f}-Fanblock.`,
      floor: () => 'Im Innenraum, rund um den Ring — am nächsten am Geschehen.',
      stands: () => 'Auf den weiteren Tribünen der Arena.',
    },
    block: (b) => `Block ${b}`,
    ctaFans: (f) => `Platz wählen — ${f}-Fanblock`,
    ctaMain: 'Platz im offiziellen Shop wählen',
    allAreas: (p) => `Alle Bereiche · offizieller ${p}-Shop`,
    fansShop: (f) => `${f}-Fanblock`,
    hint: 'Tippe auf einen Block',
    note: (p) => `Tickets verkauft ${p} im offiziellen Shop — Preise und Verfügbarkeit findest du dort. AlbaGo zeigt dir den Weg.`,
    facts: ['Stadion mit 54.600 Plätzen', 'Ring in der Mitte', (s, f) => `${s} = ${f}-Fans`],
    floor: 'Innenraum',
    close: 'Schließen',
    seen: (w) => `Freie Plätze gesehen · ${w}`,
    seenTag: 'freie Plätze gesehen',
    seenHere: (w) => `Hier waren am ${w} Plätze frei — live im Shop prüfen.`,
    seenNote: 'Grün = Plätze, die wir zu diesem Zeitpunkt im offiziellen Shop frei gesehen haben. Das ändert sich schnell — der Shop ist live.',
  },
  es: {
    title: 'Elige tu sitio',
    sub: (p) => `Toca cualquier bloque para ver dónde está — y elige tu asiento exacto en la tienda oficial de ${p}.`,
    live: 'Asientos en vivo en la tienda oficial',
    zone: { fan_lower: (f) => `Afición de ${f} · grada baja`, fan_upper: (f) => `Afición de ${f} · grada alta`, floor: () => 'Pista, alrededor del ring', stands: () => 'Otras gradas' },
    where: {
      fan_lower: (s, f) => `${s}, grada baja — la zona de la afición de ${f}.`,
      fan_upper: (s, f) => `${s}, grada alta — la zona de la afición de ${f}.`,
      floor: () => 'En la pista, alrededor del ring — lo más cerca de la acción.',
      stands: () => 'En las otras gradas del estadio.',
    },
    block: (b) => `Bloque ${b}`,
    ctaFans: (f) => `Elige tu asiento — afición de ${f}`,
    ctaMain: 'Elige tu asiento en la tienda oficial',
    allAreas: (p) => `Todas las zonas · tienda oficial de ${p}`,
    fansShop: (f) => `Afición de ${f}`,
    hint: 'Toca un bloque del mapa',
    note: (p) => `Las entradas las vende ${p} en la tienda oficial — precios y disponibilidad están allí. AlbaGo te muestra el camino.`,
    facts: ['Estadio de 54.600 plazas', 'Ring en el centro', (s, f) => `${s} = afición de ${f}`],
    floor: 'Pista',
    close: 'Cerrar',
    seen: (w) => `Asientos libres vistos · ${w}`,
    seenTag: 'asientos libres vistos',
    seenHere: (w) => `Había asientos libres aquí el ${w} — compruébalo en vivo en la tienda.`,
    seenNote: 'Verde = asientos que vimos libres en la tienda oficial en ese momento. Cambia rápido — la tienda está en vivo.',
  },
}

const ZONES: Zone[] = ['fan_lower', 'fan_upper', 'floor', 'stands']

type Hover = { text: string; clientX: number; clientY: number; kind: 'block' | 'seat' } | null
type Tip = { text: string; x: number; y: number } | null

export default function StadiumGuide({ eventId, guide }: { eventId: string; guide: OfficialSeatGuide }) {
  const { language } = useLanguage()
  // Set after mount: English on the server and first paint (no hydration
  // mismatch), then localize; the snapshot's age is judged on the client too.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
  }, [])
  const lang: Lang = now !== null && (language === 'sq' || language === 'de' || language === 'es') ? language : 'en'
  const c = COPY[lang]
  const { fighter, flag, name: stand } = guide.fanStand

  const seen = guide.seen && now !== null && now - Date.parse(guide.seen.at) < SEEN_MAX_DAYS * 86_400_000 ? guide.seen : null
  const seenWhen = seen
    ? new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(seen.at))
    : ''
  /** The channel a block was seen free in, if any. */
  const seenIn = (label: string): 'fans' | 'main' | null => (!seen ? null : seen.fans.includes(label) ? 'fans' : seen.main.includes(label) ? 'main' : null)
  const [seenOnly, setSeenOnly] = useState(false)

  const map = venueMapById(guide.venueMapId)
  const zoneOf = useMemo(
    () =>
      (b: MapBlock): Zone =>
        b.tier === -1 ? 'floor' : b.side && guide.fanStand.sides.includes(b.side) ? (b.tier === 0 ? 'fan_lower' : 'fan_upper') : 'stands',
    [guide.fanStand.sides],
  )
  // area = the block's zone; category = what it's coloured and filtered by
  // (the zone, or 'seen' while only seen-free blocks are shown).
  const stock = useMemo<StockBlock[]>(
    () =>
      map
        ? allBlocks(map)
            .filter((b) => b.label)
            .map((shape) => {
              const z = zoneOf(shape)
              const isSeen = seenOnly && !!seen && (seen.fans.includes(shape.label!) || seen.main.includes(shape.label!))
              return { block: { category: isSeen ? 'seen' : z, area: z, block: shape.label! }, shape, free: 1 }
            })
        : [],
    [map, zoneOf, seenOnly, seen],
  )

  const [zone, setZone] = useState<Zone | null>(null)
  const [picked, setPicked] = useState<StockBlock | null>(null)
  const [hover, setHover] = useState<Tip>(null)
  const frame = useRef<HTMLDivElement>(null)
  const suppressClick = useRef(false)

  if (!map) return null

  // A block seen free in a channel goes to that channel; otherwise the zone decides.
  const channelOf = (z: Zone, label: string): 'fans' | 'main' => seenIn(label) ?? (z === 'stands' ? 'main' : 'fans')
  const describe = (s: StockBlock) =>
    `${c.block(s.block.block)} · ${c.zone[s.block.area as Zone](fighter)}${seenIn(s.block.block) ? ` · ✓ ${c.seenTag}` : ''}`
  const openShop = (z: Zone | 'all', block?: string) =>
    trackInteraction('official_shop_click', {
      entityType: 'event',
      entityId: eventId,
      source: 'stadium_guide',
      meta: { zone: z, block: block ?? null, seen: block ? !!seenIn(block) : null },
    })
  const seenShapes = seen && !seenOnly && !zone ? stock.filter((s) => seenIn(s.block.block)).map((s) => s.shape) : []

  const pickedZone = (picked?.block.area as Zone | undefined) ?? null
  const pickedChannel = picked && pickedZone ? channelOf(pickedZone, picked.block.block) : null
  // Tooltip position relative to the map, measured in the pointer handler (not during render).
  const onHover = (info: Hover) => {
    const box = frame.current?.getBoundingClientRect()
    setHover(info && box ? { text: info.text, x: info.clientX - box.left, y: info.clientY - box.top } : null)
  }

  return (
    <section aria-labelledby="stadium-guide-title" className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01]">
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="stadium-guide-title" className="font-display text-2xl leading-none text-white">
            {c.title}
          </h2>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-flame-500/40 bg-flame-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-flame-200">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flame-400" />
            </span>
            {c.live}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{c.sub(guide.promoter)}</p>

        {/* Legend = zone filter */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ZONES.map((z) => {
            const on = zone === z
            const fan = z === 'fan_lower' || z === 'fan_upper'
            return (
              <button
                key={z}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setZone(on ? null : z)
                  setSeenOnly(false)
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${on ? 'border-white/40 bg-white/15 text-white' : 'border-white/10 bg-white/[0.04] text-white/70 hover:text-white'}`}
              >
                <span className={`h-2 w-2 rounded-full ${fan && !zone ? 'animate-pulse' : ''}`} style={{ backgroundColor: ZONE_COLOR[z] }} />
                {fan ? `${flag} ` : ''}
                {c.zone[z](fighter)}
              </button>
            )
          })}
        </div>
        {seen && (
          <button
            type="button"
            aria-pressed={seenOnly}
            onClick={() => {
              setSeenOnly(!seenOnly)
              setZone(null)
            }}
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${seenOnly ? 'border-emerald-300/60 bg-emerald-400/20 text-white' : 'border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-100 hover:text-white'}`}
          >
            <Check className="h-3 w-3 text-emerald-300" strokeWidth={3} />
            {c.seen(seenWhen)}
          </button>
        )}
      </div>

      {/* The map */}
      <div ref={frame} className="relative mt-3 px-2" onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${map.viewBox.w} ${map.viewBox.h}`} className="h-auto w-full" style={{ aspectRatio: `${map.viewBox.w} / ${map.viewBox.h}` }} role="group" aria-label={c.title}>
          <StadiumArt
            map={map}
            all={allBlocks(map)}
            stock={stock}
            colorFor={(cat) => (cat === 'seen' ? SEEN_COLOR : (ZONE_COLOR[cat as Zone] ?? '#ffffff'))}
            filter={seenOnly ? 'seen' : zone}
            activeKey={picked ? blockKey(picked.block) : null}
            labels={{ floor: c.floor, ring: 'Ring' }}
            interaction={{
              onBlock: (s) => {
                setPicked(s)
                setHover(null)
                trackInteraction('seat_map_click', {
                  entityType: 'event',
                  entityId: eventId,
                  source: 'stadium_guide',
                  meta: { zone: s.block.area, block: s.block.block, seen: !!seenIn(s.block.block) },
                })
              },
              onOther: () => {},
              onHover,
              describe,
              describeOther: () => '',
              suppressClick,
            }}
          />
          {/* Seen-free marks: a soft green outline over those blocks */}
          {seenShapes.length > 0 && (
            <g pointerEvents="none" fill="none" stroke={SEEN_COLOR} strokeWidth={1.3} strokeLinejoin="round" className="animate-pulse">
              {seenShapes.map((sh) =>
                sh.d ? (
                  <path key={sh.label} d={sh.d} />
                ) : sh.rect ? (
                  <rect key={sh.label} x={sh.rect.x} y={sh.rect.y} width={sh.rect.w} height={sh.rect.h} rx={1} />
                ) : null,
              )}
            </g>
          )}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/15 bg-ink-950/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg backdrop-blur"
            style={{ left: hover.x, top: hover.y - 8 }}
          >
            {hover.text}
          </div>
        )}
      </div>

      {/* The picked block → the official seat map */}
      <div className="px-5 pb-5 pt-2">
        {picked && pickedZone ? (
          <div className="rounded-2xl border border-white/10 bg-ink-950/60 p-4" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-base font-semibold text-white">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ZONE_COLOR[pickedZone] }} />
                  {c.block(picked.block.block)}
                  {(pickedZone === 'fan_lower' || pickedZone === 'fan_upper') && (
                    <span className="rounded-full bg-flame-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-flame-200">
                      {flag} {c.fansShop(fighter)}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-white/60">{c.where[pickedZone](stand, fighter)}</p>
                {seenIn(picked.block.block) && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-emerald-200">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" strokeWidth={3} />
                    {c.seenHere(seenWhen)}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setPicked(null)} aria-label={c.close} className="rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <a
              href={guide.channels[pickedChannel ?? 'main']}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => openShop(pickedZone, picked.block.block)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-flame-400 to-flame-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(238,28,37,0.6)] ring-1 ring-inset ring-white/15 transition hover:-translate-y-0.5"
            >
              {pickedChannel === 'fans' ? c.ctaFans(fighter) : c.ctaMain}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/55">
            <MousePointerClick className="h-4 w-4 text-flame-300" />
            {c.hint}
          </p>
        )}

        {/* Facts + both official channels */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/45">
          <span>{c.facts[0]}</span>
          <span>{c.facts[1]}</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {flag} {c.facts[2](stand, fighter)}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a
            href={guide.channels.fans}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => openShop('fan_lower')}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-flame-500/40 bg-flame-500/10 px-3 py-2 text-xs font-semibold text-flame-100 transition hover:bg-flame-500/20"
          >
            {flag} {c.fansShop(fighter)}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <a
            href={guide.channels.main}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => openShop('all')}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06]"
          >
            {c.allAreas(guide.promoter)}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          {c.note(guide.promoter)}
          {seen && ` ${c.seenNote}`}
        </p>
      </div>
    </section>
  )
}
