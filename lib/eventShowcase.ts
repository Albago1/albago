/**
 * Showcase events: an event page dressed up for one special night — the
 * lineup with photos, what the ticket includes, and a "reserve your table"
 * card that writes the WhatsApp message for the guest. Keyed by event id,
 * like lib/polls.ts; the event itself (title, date, address, description)
 * stays in Supabase. Add an entry here for the next dinner-and-show night.
 */

import { normalizeWhatsApp, waLink, type WaLang } from '@/lib/seats/whatsapp'

export type ShowcaseRole = 'vocals' | 'clarinet' | 'keyboard'

export type ShowcaseArtist = {
  name: string
  role: ShowcaseRole
  /** Square-ish photo; headliners look best at 3:4. */
  photo?: string
}

export type ShowcaseInclude = 'meal' | 'drink'

export type EventShowcase = {
  eventId: string
  theme: 'christmas'
  /** Short name used in the WhatsApp message ("Merry Christmas Berlin"). */
  name: string
  venue: string
  organizer: string
  headliners: ShowcaseArtist[]
  band: ShowcaseArtist[]
  /** A folk dance group on the bill. */
  ensemble?: string
  admission: {
    priceCents: number
    currency: 'EUR'
    /** Children up to and including this age get in free. */
    kidsFreeUpToAge: number
    includes: ShowcaseInclude[]
  }
  /** The organizer's public reservation line (international format). */
  reservationPhone: string
  /** The number also takes WhatsApp messages. */
  whatsapp: boolean
  /** Official poster, shown framed on the page. */
  poster?: string
  /** CSS object-position for the hero band, so a tall poster shows faces, not chins. */
  heroFocus?: string
}

const ADHR_XMAS_MEDIA =
  'https://stvjpcqcpmhngihfjhga.supabase.co/storage/v1/object/public/event-covers/adhr-events/merry-christmas-berlin-2026'

export const SHOWCASES: EventShowcase[] = [
  {
    // Merry Christmas Berlin — Grand Gala Berlin, Spandau, 25 Dec 2026
    eventId: '33ed35f3-7c45-44ff-9845-a6d5b8c04938',
    theme: 'christmas',
    name: 'Merry Christmas Berlin',
    venue: 'Grand Gala Berlin',
    organizer: 'ADHR Events',
    headliners: [
      { name: 'Rovena Ibrahimi', role: 'vocals', photo: `${ADHR_XMAS_MEDIA}/rovena.jpg` },
      { name: 'Vani Gjuzi', role: 'vocals', photo: `${ADHR_XMAS_MEDIA}/vani.jpg` },
    ],
    band: [
      { name: 'Majkëll Fejza', role: 'clarinet', photo: `${ADHR_XMAS_MEDIA}/majkell.jpg` },
      { name: 'Denis Fejza', role: 'keyboard', photo: `${ADHR_XMAS_MEDIA}/denis.jpg` },
    ],
    ensemble: 'Ansambli Shqiponja Berlin',
    admission: {
      priceCents: 6000,
      currency: 'EUR',
      kidsFreeUpToAge: 8,
      includes: ['meal', 'drink'],
    },
    reservationPhone: '+49 176 64016246',
    whatsapp: true,
    poster: `${ADHR_XMAS_MEDIA}/poster.jpg`,
    heroFocus: '50% 37%',
  },
]

export function showcaseForEvent(eventId: string): EventShowcase | null {
  return SHOWCASES.find((s) => s.eventId === eventId) ?? null
}

export const PARTY_LIMITS = { adultsMin: 1, adultsMax: 30, kidsMin: 0, kidsMax: 20 } as const

/** Only paying guests count; children up to the free age come along free. */
export function partyTotalCents(priceCents: number, adults: number): number {
  return Math.max(0, Math.floor(adults)) * priceCents
}

// Albanian names written out: plenty of browsers ship without Albanian date
// data and would quietly print "25 December" on an Albanian page.
const SQ_MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor']
const SQ_WEEKDAYS = ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë']
const DATE_LOCALES: Record<WaLang, string> = { en: 'en-GB', sq: 'sq-AL', de: 'de-DE', es: 'es-ES' }

/** "25 dhjetor" / "E premte, 25 dhjetor" / "Friday 25 December" — first letter upper-case. */
export function formatShowcaseDate(iso: string, lang: WaLang, withWeekday = false): string {
  const d = new Date(`${iso}T12:00:00`)
  let s: string
  if (lang === 'sq') {
    s = `${d.getDate()} ${SQ_MONTHS[d.getMonth()]}`
    if (withWeekday) s = `${SQ_WEEKDAYS[d.getDay()]}, ${s}`
  } else {
    s = d.toLocaleDateString(
      DATE_LOCALES[lang],
      withWeekday ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long' },
    )
  }
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "€60" / "€120" — whole euros stay whole, cents only when there are some. */
export function formatEuro(cents: number, locale = 'de-DE'): string {
  const euros = cents / 100
  const number = euros.toLocaleString(locale, {
    minimumFractionDigits: Number.isInteger(euros) ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return locale.startsWith('en') ? `€${number}` : `${number} €`
}

type MessageWords = {
  hello: (org: string) => string
  want: (name: string, when: string) => string
  adults: (n: number, each: string) => string
  kids: (n: number, age: number) => string
  total: (sum: string) => string
  name: string
  via: string
}

const MESSAGE: Record<WaLang, MessageWords> = {
  sq: {
    hello: (o) => `Përshëndetje ${o}!`,
    want: (e, w) => `Dua të rezervoj për ${e} (${w}):`,
    adults: (n, each) => `• ${n} ${n === 1 ? 'i rritur' : 'të rritur'} (${each} secili)`,
    kids: (n, a) => `• ${n} fëmijë deri ${a} vjeç (falas)`,
    total: (s) => `Totali: ${s}`,
    name: 'Emri:',
    via: '(E gjeta në AlbaGo)',
  },
  en: {
    hello: (o) => `Hi ${o}!`,
    want: (e, w) => `I'd like to reserve for ${e} (${w}):`,
    adults: (n, each) => `• ${n} ${n === 1 ? 'adult' : 'adults'} (${each} each)`,
    kids: (n, a) => `• ${n} ${n === 1 ? 'child' : 'children'} aged ${a} or under (free)`,
    total: (s) => `Total: ${s}`,
    name: 'Name:',
    via: '(Found it on AlbaGo)',
  },
  de: {
    hello: (o) => `Hallo ${o}!`,
    want: (e, w) => `Ich möchte für ${e} (${w}) reservieren:`,
    adults: (n, each) => `• ${n} ${n === 1 ? 'Erwachsener' : 'Erwachsene'} (je ${each})`,
    kids: (n, a) => `• ${n} ${n === 1 ? 'Kind' : 'Kinder'} bis ${a} Jahre (frei)`,
    total: (s) => `Gesamt: ${s}`,
    name: 'Name:',
    via: '(Über AlbaGo gefunden)',
  },
  es: {
    hello: (o) => `¡Hola ${o}!`,
    want: (e, w) => `Quisiera reservar para ${e} (${w}):`,
    adults: (n, each) => `• ${n} ${n === 1 ? 'adulto' : 'adultos'} (${each} cada uno)`,
    kids: (n, a) => `• ${n} ${n === 1 ? 'niño' : 'niños'} de hasta ${a} años (gratis)`,
    total: (s) => `Total: ${s}`,
    name: 'Nombre:',
    via: '(Lo encontré en AlbaGo)',
  },
}

/** The ready-to-send WhatsApp text: who's coming, what it costs, a line for the name. */
export function reservationMessage(
  showcase: EventShowcase,
  lang: WaLang,
  when: string,
  adults: number,
  kids: number,
): string {
  const w = MESSAGE[lang]
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'
  const { priceCents, kidsFreeUpToAge } = showcase.admission
  const lines = [
    w.hello(showcase.organizer),
    w.want(showcase.name, when),
    w.adults(adults, formatEuro(priceCents, locale)),
    ...(kids > 0 ? [w.kids(kids, kidsFreeUpToAge)] : []),
    w.total(formatEuro(partyTotalCents(priceCents, adults), locale)),
    '',
    w.name,
    '',
    w.via,
  ]
  return lines.join('\n')
}

/** wa.me link to the organizer with the message filled in; null without a usable number. */
export function reservationWhatsAppHref(
  showcase: EventShowcase,
  lang: WaLang,
  when: string,
  adults: number,
  kids: number,
): string | null {
  if (!showcase.whatsapp) return null
  const digits = normalizeWhatsApp(showcase.reservationPhone)
  if (!digits) return null
  return waLink(digits, reservationMessage(showcase, lang, when, adults, kids))
}

/** tel: link — digits only, with the leading +. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
