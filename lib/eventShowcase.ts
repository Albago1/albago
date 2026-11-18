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
  /** Organizer's logo — light artwork on a transparent background, shown on a dark tile. */
  organizerLogo?: string
  /** Line under the organizer's name ("Berlin"). */
  organizerCity?: string
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

const ADHR_MEDIA =
  'https://stvjpcqcpmhngihfjhga.supabase.co/storage/v1/object/public/event-covers/adhr-events'
const ADHR_XMAS_MEDIA = `${ADHR_MEDIA}/merry-christmas-berlin-2026`

export const SHOWCASES: EventShowcase[] = [
  {
    // Merry Christmas Berlin — Grand Gala Berlin, Spandau, 25 Dec 2026
    eventId: '33ed35f3-7c45-44ff-9845-a6d5b8c04938',
    theme: 'christmas',
    name: 'Merry Christmas Berlin',
    venue: 'Grand Gala Berlin',
    organizer: 'ADHR Events',
    // Cut out of the poster; ask ADHR for the original file to sharpen it.
    organizerLogo: `${ADHR_MEDIA}/adhr-logo.png`,
    organizerCity: 'Berlin',
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
  people: string
  name: string
  via: string
}

const MESSAGE: Record<WaLang, MessageWords> = {
  sq: {
    hello: (o) => `Përshëndetje ${o}!`,
    want: (e, w) => `Dua të rezervoj për ${e} (${w}).`,
    people: 'Numri i personave:',
    name: 'Emri:',
    via: '(E gjeta në AlbaGo)',
  },
  en: {
    hello: (o) => `Hi ${o}!`,
    want: (e, w) => `I'd like to reserve for ${e} (${w}).`,
    people: 'Number of people:',
    name: 'Name:',
    via: '(Found it on AlbaGo)',
  },
  de: {
    hello: (o) => `Hallo ${o}!`,
    want: (e, w) => `Ich möchte für ${e} (${w}) reservieren.`,
    people: 'Anzahl Personen:',
    name: 'Name:',
    via: '(Über AlbaGo gefunden)',
  },
  es: {
    hello: (o) => `¡Hola ${o}!`,
    want: (e, w) => `Quisiera reservar para ${e} (${w}).`,
    people: 'Número de personas:',
    name: 'Nombre:',
    via: '(Lo encontré en AlbaGo)',
  },
}

/** The ready-to-send WhatsApp text: a reservation request with blanks for party size and name. */
export function reservationMessage(showcase: EventShowcase, lang: WaLang, when: string): string {
  const w = MESSAGE[lang]
  return [
    w.hello(showcase.organizer),
    w.want(showcase.name, when),
    '',
    w.people,
    w.name,
    '',
    w.via,
  ].join('\n')
}

/** wa.me link to the organizer with the message filled in; null without a usable number. */
export function reservationWhatsAppHref(showcase: EventShowcase, lang: WaLang, when: string): string | null {
  if (!showcase.whatsapp) return null
  const digits = normalizeWhatsApp(showcase.reservationPhone)
  if (!digits) return null
  return waLink(digits, reservationMessage(showcase, lang, when))
}

const QUESTION: Record<WaLang, (org: string, name: string, when: string) => string> = {
  sq: (o, e, w) => `Përshëndetje ${o}! Kam një pyetje për ${e} (${w}):`,
  en: (o, e, w) => `Hi ${o}! I have a question about ${e} (${w}):`,
  de: (o, e, w) => `Hallo ${o}! Ich habe eine Frage zu ${e} (${w}):`,
  es: (o, e, w) => `¡Hola ${o}! Tengo una pregunta sobre ${e} (${w}):`,
}

/** wa.me link for a general question to the organizer (the contact card). */
export function questionWhatsAppHref(showcase: EventShowcase, lang: WaLang, when: string): string | null {
  if (!showcase.whatsapp) return null
  const digits = normalizeWhatsApp(showcase.reservationPhone)
  if (!digits) return null
  const text = [QUESTION[lang](showcase.organizer, showcase.name, when), '', '', MESSAGE[lang].via].join('\n')
  return waLink(digits, text)
}

/** tel: link — digits only, with the leading +. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
