import { generateText, type LanguageModel } from 'ai'
import { EVENT_TYPES } from '../contract/taxonomy'
import { foldText } from '../core/text'
import { emptyExtraction, type ExtractionV1 } from './extraction'
import { parseModelJson } from './modelJson'

/**
 * AI reading of one page's evidence into an ExtractionV1. Customer-neutral:
 * the engine taxonomy, the source's own language, no consumer rules.
 *
 * Anti-hallucination contract enforced in CODE, not just in the prompt: for
 * the fields that send people to the wrong place (date, time, venue, city,
 * price) the model must quote the exact words from the page. A value whose
 * quote is missing or not found in the page text is dropped to null.
 */

const QUOTED_FIELDS = ['start_date', 'start_time', 'venue_name', 'locality', 'price_text'] as const
type QuotedField = (typeof QUOTED_FIELDS)[number]

const SYSTEM = `You read evidence from ONE web page (visible text, title, structured data) and extract the single main event it announces, as strict JSON.

Rules:
1. NEVER invent. If the page does not state something, use null (or [] for lists). An empty field is fine; a guessed one is harmful.
2. For start_date, start_time, venue_name, locality and price_text you MUST copy into "quotes" the exact words from the page that state them (a short verbatim snippet, 2–80 characters). If you cannot quote it, return null for that field.
3. Dates as ISO YYYY-MM-DD, resolved with the reference date given. If the year is missing, use the next occurrence on or after the reference date. Month names may be Albanian (janar, shkurt, mars, prill, maj, qershor, korrik, gusht, shtator, tetor, nëntor, dhjetor), German, Italian, French, Spanish or English.
4. Times 24h HH:MM; prefer the start time over doors.
5. event_type: exactly one of ${EVENT_TYPES.join(', ')}.
6. title and description in the page's own language; description = 1–3 sentences from the page's own wording.
7. performers: artist/speaker names as written, biggest billing first. organizer_name: who organises, as written.
8. promotion_languages: ISO 639-1 codes of the languages the event is advertised in on this page.
9. audience_statements: verbatim phrases where the page says who the event is FOR (e.g. a community, an age group). [] if none.
10. cultural_occasion: a named holiday/celebration the event marks, as written, else null.
11. status: scheduled, cancelled, postponed or rescheduled — only if stated, else null.
12. is_event: false for listings of many events, profiles, shops, news without one specific event, login walls.

Return ONLY JSON with exactly these keys:
{"is_event":bool,"title":"","description":"","language":"","event_type":"","tags":[],"start_date":"","start_time":"","end_date":"","end_time":"","status":"","venue_name":"","address":"","locality":"","country":"","organizer_name":"","performers":[],"promotion_languages":[],"audience_statements":[],"cultural_occasion":"","price_text":"","ticket_url":"","quotes":{"start_date":"","start_time":"","venue_name":"","locality":"","price_text":""}}`

const s = (v: unknown, max = 500): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const arr = (v: unknown, max = 20): string[] =>
  Array.isArray(v) ? v.map((x) => s(x, 200)).filter((x): x is string => !!x).slice(0, max) : []

/** Whitespace/accent/case-insensitive "does the page really say this". */
export function quoteFoundIn(quote: string | null, haystack: string): boolean {
  if (!quote || quote.trim().length < 2) return false
  const norm = (t: string) => foldText(t).replace(/[\s ]+/g, ' ').replace(/[“”"«»]/g, '"').trim()
  return norm(haystack).includes(norm(quote))
}

/** Turn raw model JSON into a validated extraction, enforcing quotes. Pure — unit-tested. */
export function coerceModelExtraction(raw: unknown, evidenceText: string): ExtractionV1 {
  const x = emptyExtraction()
  if (typeof raw !== 'object' || raw === null) {
    x.issues.push('model_output_unusable')
    return x
  }
  const r = raw as Record<string, unknown>
  const quotes = (typeof r.quotes === 'object' && r.quotes ? r.quotes : {}) as Record<string, unknown>

  x.is_event = r.is_event === true
  x.title = s(r.title, 300)
  x.description = s(r.description, 2000)
  x.language = s(r.language, 5)
  const type = s(r.event_type, 40)
  x.event_type = type && (EVENT_TYPES as readonly string[]).includes(type) ? (type as ExtractionV1['event_type']) : null
  x.tags = arr(r.tags, 5).map((t) => t.toLowerCase())
  x.end_date = s(r.end_date, 10)
  x.end_time = s(r.end_time, 5)
  const status = s(r.status, 20)
  x.status = status && ['scheduled', 'cancelled', 'postponed', 'rescheduled'].includes(status) ? (status as ExtractionV1['status']) : null
  x.address = s(r.address, 300)
  x.country = s(r.country, 80)
  x.organizer_name = s(r.organizer_name, 200)
  x.performers = arr(r.performers, 30)
  x.promotion_languages = arr(r.promotion_languages, 5).map((l) => l.toLowerCase()).filter((l) => /^[a-z]{2}$/.test(l))
  x.audience_statements = arr(r.audience_statements, 5).filter((q) => quoteFoundIn(q, evidenceText))
  x.cultural_occasion = s(r.cultural_occasion, 200)
  const ticket = s(r.ticket_url, 500)
  x.ticket_url = ticket && /^https?:\/\//.test(ticket) ? ticket : null

  for (const field of QUOTED_FIELDS) {
    const value = s(r[field], field === 'price_text' ? 500 : 200)
    if (!value) continue
    if (quoteFoundIn(s(quotes[field], 200), evidenceText)) {
      ;(x as Record<QuotedField, string | null>)[field] = value
      x.field_status[field] = 'stated'
    } else {
      x.issues.push(`unsupported_${field}`)
    }
  }
  for (const field of ['title', 'description', 'organizer_name', 'performers', 'address', 'country', 'end_date', 'end_time', 'ticket_url'] as const) {
    const v = x[field]
    if (Array.isArray(v) ? v.length : v) x.field_status[field] = 'stated'
  }
  return x
}

export async function extractWithModel(
  model: LanguageModel,
  evidence: { url: string | null; title: string | null; text: string; jsonldSummary: string | null },
  referenceDate: string,
): Promise<ExtractionV1> {
  const pageText = [evidence.title ? `Title: ${evidence.title}` : null, evidence.text].filter(Boolean).join('\n')
  const prompt = [
    `Reference date: ${referenceDate}`,
    evidence.url ? `Page URL: ${evidence.url}` : null,
    evidence.jsonldSummary ? `Structured data (may contain errors):\n${evidence.jsonldSummary}` : null,
    `Page text:\n${pageText.slice(0, 12_000)}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const { text } = await generateText({ model, system: SYSTEM, prompt, temperature: 0 })
  return coerceModelExtraction(parseModelJson(text), `${pageText}\n${evidence.jsonldSummary ?? ''}`)
}
