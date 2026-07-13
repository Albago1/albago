import { generateText } from 'ai'
import { textModel } from './textModel'
import { parseModelJson } from './parseModelJson'

/**
 * AlbaGo Lens (LENS-3): auto-translate a scanned event's title + description
 * into all four platform languages so an event read off an Albanian poster is
 * readable to every visitor. One free-tier Gemini call returns both packs.
 *
 * Governing rule, inherited from the poster reader: never invent. This only
 * TRANSLATES the text it is given — no added facts, no embellishment. Any
 * malformed response is discarded (returns null) so the caller falls back to
 * the single original-language text; quality can only go up, never down.
 */

export const LANG_KEYS = ['en', 'sq', 'de', 'es'] as const
export type LangKey = (typeof LANG_KEYS)[number]
export type LangPack = Record<LangKey, string>

export type EventTranslation = {
  title: LangPack
  description: LangPack
}

export type TranslateInput = {
  title: string
  description: string
  /** ISO 639-1 of the source text, used only to tell the model what it's reading. */
  sourceLanguage?: string
}

const LANG_NAMES: Record<LangKey, string> = {
  en: 'English',
  sq: 'Albanian',
  de: 'German',
  es: 'Spanish',
}

const SYSTEM_PROMPT =
  'You are a professional translator for AlbaGo, an events platform for Albania and its ' +
  'diaspora. Translate the event TITLE and DESCRIPTION you are given into English (en), ' +
  'Albanian (sq), German (de) and Spanish (es). Hard rules: ' +
  '(1) Translate only — never add, remove, or invent facts, dates, prices, names, or lineups. ' +
  '(2) Keep proper nouns, artist names, venue names, and brand names EXACTLY as written — do ' +
  'not translate or transliterate them. ' +
  '(3) A title that is a proper noun or already language-neutral stays identical across languages. ' +
  '(4) Preserve line breaks and the general shape of the description. ' +
  '(5) Natural, native phrasing in each language — not word-for-word. ' +
  'Respond with ONLY a JSON object, no markdown fences, of exactly this shape: ' +
  '{"title":{"en":"","sq":"","de":"","es":""},"description":{"en":"","sq":"","de":"","es":""}}. ' +
  'If the description is empty, return empty strings for every description language.'

function buildPrompt(input: TranslateInput): string {
  const src = input.sourceLanguage
    ? LANG_NAMES[input.sourceLanguage as LangKey] ?? input.sourceLanguage
    : 'unknown'
  return [
    `Source language: ${src}`,
    `TITLE:\n${input.title}`,
    `DESCRIPTION:\n${input.description || '(none)'}`,
  ].join('\n\n')
}

function parsePack(value: unknown): LangPack | null {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  const out = {} as LangPack
  for (const key of LANG_KEYS) {
    const v = obj[key]
    // Strings only. Empty is allowed (empty description); we coerce to ''.
    out[key] = typeof v === 'string' ? v.trim() : ''
  }
  return out
}

function parseTranslation(raw: string): EventTranslation | null {
  const parsed = parseModelJson(raw)
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  const title = parsePack(obj.title)
  const description = parsePack(obj.description)
  if (!title || !description) return null
  // A translation with no usable title in any language is worthless.
  if (!LANG_KEYS.some((k) => title[k].length > 0)) return null
  return { title, description }
}

/**
 * Returns the four-language title + description packs, or null when the model
 * fails or misbehaves — callers keep the single original-language text.
 */
export async function translateEventText(
  input: TranslateInput,
): Promise<EventTranslation | null> {
  if (!input.title.trim()) return null
  try {
    const { text } = await generateText({
      model: textModel(),
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input),
      maxOutputTokens: 3000,
      // Translation gates the scan response and runs in parallel with
      // resolution — cap it so a slow model can't push the request past the
      // route's maxDuration. On timeout it aborts and we fail-open to null.
      abortSignal: AbortSignal.timeout(20_000),
    })
    return parseTranslation(text)
  } catch (err) {
    console.error('translateEventText failed:', err)
    return null
  }
}
