import { generateText } from 'ai'
import { google } from '@ai-sdk/google'

/**
 * AI share captions — one generation per event produces a caption pack in
 * all four platform languages, cached forever next to the poster art.
 *
 * The style contract below is the product: hooks that stop the scroll
 * without clickbait, concrete details from the event itself (never invented
 * facts), restrained emoji, and reach-tuned hashtags. Anything the model
 * returns that violates the shape is discarded in favor of the classic
 * template caption, so quality can only go up, never down.
 */

export type CaptionEventContext = {
  title: string
  description: string | null
  category: string | null
  city: string
  country: string | null
  isCivic: boolean
  tags: string[] | null
  venueName?: string | null
  address?: string | null
  date: string
  time?: string | null
  endTime?: string | null
  organizerName?: string | null
  eventUrl: string
}

export type CaptionPack = {
  en: string
  sq: string
  de: string
  es: string
}

const LANG_KEYS = ['en', 'sq', 'de', 'es'] as const

const SYSTEM_PROMPT =
  'You are the social media copywriter for AlbaGo, the events platform for Albania and its ' +
  'diaspora. You write share captions that earn organic reach on Instagram, TikTok and ' +
  'Facebook while sounding like a confident human, never like marketing. ' +
  'Non-negotiable style contract: ' +
  '(1) Line one is the hook — a concrete, curiosity-pulling statement drawn from THIS ' +
  "event's real details. No clickbait, no questions like \"Are you ready?\", no \"Don't miss\". " +
  '(2) Then 1-3 short lines that sell the experience with specifics from the description. ' +
  'Never invent facts, lineups, or prices that are not in the data. ' +
  '(3) Then a compact info block: 📅 date · 🕒 time · 📍 place — these three emoji are the ' +
  'ONLY emoji allowed in the entire caption, and at most one more in the hook if it truly ' +
  'earns its place. No emoji walls. No ALL-CAPS words. Banned words in any language: epic, ' +
  'insane, vibes, unforgettable, spectacular, amazing. ' +
  '(4) Then the link on its own line, copied EXACTLY as given. ' +
  '(5) Last line: 6-9 hashtags — always #AlbaGo, the city, the category niche, and for ' +
  'diaspora-relevant events #DiasporaShqiptare; never #follow #viral #fyp or other spam tags. ' +
  '(6) Civic protests: dignified, mobilizing, peaceful — pride and determination, zero ' +
  'aggression, zero irony. ' +
  '(7) Each caption under 850 characters. ' +
  'Respond with ONLY a JSON object, no markdown fences, with keys "en", "sq", "de", "es" — ' +
  'the same caption natively written (not translated word-for-word) in English, Albanian, ' +
  'German and Spanish. Hashtags may stay identical across languages.'

function buildContext(event: CaptionEventContext): string {
  return [
    `Title: ${event.title}`,
    event.category ? `Category: ${event.category}` : null,
    `City: ${event.city}${event.country ? `, ${event.country}` : ''}`,
    event.venueName ? `Venue: ${event.venueName}` : null,
    event.address ? `Address: ${event.address}` : null,
    `Date: ${event.date}`,
    event.time ? `Start: ${event.time}${event.endTime ? ` — ${event.endTime}` : ''}` : null,
    event.organizerName ? `Organizer: ${event.organizerName}` : null,
    event.isCivic ? 'This is a civic protest / demonstration.' : null,
    event.tags?.length ? `Tags: ${event.tags.slice(0, 8).join(', ')}` : null,
    event.description ? `Description: ${event.description.slice(0, 1500)}` : null,
    `Link (copy exactly): ${event.eventUrl}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function parsePack(raw: string): CaptionPack | null {
  try {
    // Strip accidental markdown fences before parsing.
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    for (const key of LANG_KEYS) {
      const value = parsed[key]
      if (typeof value !== 'string' || value.trim().length < 40) return null
    }
    return {
      en: (parsed.en as string).trim(),
      sq: (parsed.sq as string).trim(),
      de: (parsed.de as string).trim(),
      es: (parsed.es as string).trim(),
    }
  } catch {
    return null
  }
}

/**
 * Returns the four-language caption pack, or null when the model fails or
 * misbehaves — callers fall back to the classic template caption.
 */
export async function craftCaptionPack(
  event: CaptionEventContext,
): Promise<CaptionPack | null> {
  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: SYSTEM_PROMPT,
      prompt: buildContext(event),
      maxOutputTokens: 4000,
    })
    const pack = parsePack(text)
    if (!pack) {
      console.error('ai-caption: model returned an invalid pack, falling back')
      return null
    }
    // The link must survive verbatim in every language.
    for (const key of LANG_KEYS) {
      if (!pack[key].includes(event.eventUrl)) {
        console.error(`ai-caption: link missing in "${key}" caption, falling back`)
        return null
      }
    }
    return pack
  } catch (err) {
    console.error('ai-caption crafting failed:', err)
    return null
  }
}
