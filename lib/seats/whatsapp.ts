/**
 * WhatsApp between seat buyers and the seller. Every message is written for
 * the moment it's sent from — a question about the seats someone has picked,
 * "I've paid" with the reference and amount, the seller's step-by-step
 * replies — so nobody has to type the details. Links open wa.me, which
 * works in the WhatsApp app and on the web.
 */

export type WaLang = 'en' | 'sq' | 'de' | 'es'

export const asWaLang = (lang: string | null | undefined): WaLang =>
  lang === 'sq' || lang === 'de' || lang === 'es' ? lang : 'en'

/**
 * "+49 151 2345 678" or "0049 151…" → "491512345678". A number without a
 * country code ("0151…") can't be told apart (German? Swiss?), so it's null.
 */
export function normalizeWhatsApp(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim()
  let digits: string
  if (s.startsWith('+')) digits = s.slice(1)
  else if (s.startsWith('00')) digits = s.slice(2)
  else return null
  digits = digits.replace(/[\s()./-]/g, '')
  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : null
}

/** wa.me link; without a number WhatsApp lets the sender pick the chat (sharing). */
export function waLink(number: string | null, text: string): string {
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`
}

/** "+49 151 2345678" for showing a saved number. */
export function formatWhatsApp(digits: string): string {
  return `+${digits}`
}

/** Words for seatsLine() in each language. */
export const SEAT_WORDS: Record<WaLang, { block: string; row: string; seats: string }> = {
  en: { block: 'Block', row: 'Row', seats: 'Seats' },
  sq: { block: 'Blloku', row: 'Rreshti', seats: 'Vendet' },
  de: { block: 'Block', row: 'Reihe', seats: 'Plätze' },
  es: { block: 'Bloque', row: 'Fila', seats: 'Asientos' },
}

// -- Buyer → seller --------------------------------------------------------------

const BUYER: Record<WaLang, {
  ask: (seller: string, event: string) => string
  askSeats: (seats: string) => string
  paid: (seller: string, amount: string, ref: string, event: string) => string
  order: (seller: string, ref: string, event: string) => string
  seats: string
  eventim: string
}> = {
  en: {
    ask: (s, e) => `Hi ${s}! I have a question about the seats for ${e}.`,
    askSeats: (seats) => ` I'm looking at ${seats}.`,
    paid: (s, a, r, e) => `Hi ${s}! I've just paid ${a} for reservation ${r} (${e}).`,
    order: (s, r, e) => `Hi ${s}! A question about my reservation ${r} (${e}):`,
    seats: 'Seats',
    eventim: 'Eventim email',
  },
  sq: {
    ask: (s, e) => `Përshëndetje ${s}! Kam një pyetje për vendet në ${e}.`,
    askSeats: (seats) => ` Po shikoj ${seats}.`,
    paid: (s, a, r, e) => `Përshëndetje ${s}! Sapo pagova ${a} për rezervimin ${r} (${e}).`,
    order: (s, r, e) => `Përshëndetje ${s}! Kam një pyetje për rezervimin tim ${r} (${e}):`,
    seats: 'Vendet',
    eventim: 'Email-i Eventim',
  },
  de: {
    ask: (s, e) => `Hallo ${s}! Ich habe eine Frage zu den Plätzen für ${e}.`,
    askSeats: (seats) => ` Es geht um ${seats}.`,
    paid: (s, a, r, e) => `Hallo ${s}! Ich habe gerade ${a} für die Reservierung ${r} (${e}) bezahlt.`,
    order: (s, r, e) => `Hallo ${s}! Eine Frage zu meiner Reservierung ${r} (${e}):`,
    seats: 'Plätze',
    eventim: 'Eventim-E-Mail',
  },
  es: {
    ask: (s, e) => `¡Hola ${s}! Tengo una pregunta sobre los asientos para ${e}.`,
    askSeats: (seats) => ` Me interesan ${seats}.`,
    paid: (s, a, r, e) => `¡Hola ${s}! Acabo de pagar ${a} por la reserva ${r} (${e}).`,
    order: (s, r, e) => `¡Hola ${s}! Una pregunta sobre mi reserva ${r} (${e}):`,
    seats: 'Asientos',
    eventim: 'Email de Eventim',
  },
}

export function buyerAskMessage(lang: WaLang, d: { seller: string; event: string; seats?: string | null }): string {
  const c = BUYER[lang]
  return c.ask(d.seller, d.event) + (d.seats ? c.askSeats(d.seats) : '')
}

export function buyerPaidMessage(
  lang: WaLang,
  d: { seller: string; event: string; reference: string; amount: string; seats: string; eventimEmail: string },
): string {
  const c = BUYER[lang]
  return [c.paid(d.seller, d.amount, d.reference, d.event), `${c.seats}: ${d.seats}`, `${c.eventim}: ${d.eventimEmail}`].join('\n')
}

export function buyerOrderMessage(lang: WaLang, d: { seller: string; event: string; reference: string }): string {
  return BUYER[lang].order(d.seller, d.reference, d.event)
}

// -- Seller → buyer (quick replies in the seat console) -----------------------------

export type SellerReplyLang = 'sq' | 'de' | 'en'
export type SellerReplyStep = 'held' | 'paid' | 'transfer_sent' | 'delivered'

type ReplyData = { name: string; reference: string; event: string; amount: string; eventimEmail: string }

const SELLER: Record<SellerReplyLang, Record<SellerReplyStep, (d: ReplyData) => string>> = {
  sq: {
    held: (d) =>
      `Përshëndetje ${d.name}! Rezervimi yt ${d.reference} për ${d.event} është gati (${d.amount}). Mund të paguash te "Vendet e mia" në AlbaGo — me kodin QR në aplikacionin e bankës ose me PayPal.`,
    paid: (d) =>
      `Përshëndetje ${d.name}! Pagesa për ${d.reference} na erdhi ✅ Biletat i transferojmë në llogarinë tënde Eventim (${d.eventimEmail}) sa më shpejt.`,
    transfer_sent: (d) =>
      `Përshëndetje ${d.name}! Biletat për ${d.reference} u dërguan në llogarinë tënde Eventim (${d.eventimEmail}). Hape aplikacionin Eventim, prano transferimin dhe shtyp "I mora biletat" në AlbaGo.`,
    delivered: (d) => `Faleminderit ${d.name}! Shihemi në ${d.event} 🇦🇱🥊`,
  },
  de: {
    held: (d) =>
      `Hallo ${d.name}! Deine Reservierung ${d.reference} für ${d.event} steht (${d.amount}). Bezahlen kannst du unter "Meine Plätze" auf AlbaGo — per QR-Code in deiner Banking-App oder mit PayPal.`,
    paid: (d) =>
      `Hallo ${d.name}! Deine Zahlung für ${d.reference} ist angekommen ✅ Wir übertragen die Tickets so schnell wie möglich auf dein Eventim-Konto (${d.eventimEmail}).`,
    transfer_sent: (d) =>
      `Hallo ${d.name}! Die Tickets für ${d.reference} sind an dein Eventim-Konto (${d.eventimEmail}) unterwegs. Öffne die Eventim-App, nimm die Übertragung an und tippe auf AlbaGo auf "Ich habe meine Tickets".`,
    delivered: (d) => `Danke ${d.name}! Wir sehen uns bei ${d.event} 🥊`,
  },
  en: {
    held: (d) =>
      `Hi ${d.name}! Your reservation ${d.reference} for ${d.event} is ready (${d.amount}). You can pay under "My seats" on AlbaGo — with the QR code in your banking app or with PayPal.`,
    paid: (d) =>
      `Hi ${d.name}! Your payment for ${d.reference} arrived ✅ We'll transfer the tickets to your Eventim account (${d.eventimEmail}) as soon as we can.`,
    transfer_sent: (d) =>
      `Hi ${d.name}! The tickets for ${d.reference} are on their way to your Eventim account (${d.eventimEmail}). Open the Eventim app, accept the transfer, then tap "I got my tickets" on AlbaGo.`,
    delivered: (d) => `Thank you ${d.name}! See you at ${d.event} 🥊`,
  },
}

export function sellerReply(lang: SellerReplyLang, step: SellerReplyStep, d: ReplyData): string {
  return SELLER[lang][step](d)
}
