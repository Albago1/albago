import { generateText, type ModelMessage } from 'ai'
import { google } from '@ai-sdk/google'

/**
 * Art direction for AI-generated share-poster backdrops.
 *
 * The image model paints ONLY the atmosphere — every word on the poster
 * (title, date, venue, QR) is rendered by the existing share templates.
 * Image models produce broken text, so the prompt forbids it outright and
 * asks for negative space where the template's typography lands.
 *
 * Context laddering (all free tier): the crafting model gets the full event
 * record, LOOKS at the event's own uploaded photos (multimodal input), is
 * told to apply its world knowledge of the artist/event name, and — best
 * effort — Google Search grounding. Each rung degrades gracefully:
 * full context → text-only → deterministic category scene.
 */

export type PosterEventContext = {
  title: string
  description: string | null
  category: string | null
  city: string
  country: string | null
  isCivic: boolean
  tags: string[] | null
  venueName?: string | null
  addressHint?: string | null
  date?: string | null
  time?: string | null
  expectedAttendees?: number | null
  organizerName?: string | null
  /** Event's own uploaded images — banner first, then gallery. */
  imageUrls?: string[]
}

const BRAND_CANVAS =
  'Vertical 9:16 cinematic poster backdrop. Near-black ink (#050505) base, ' +
  'flame red (#EE1C25) as the only strong color — as light: neon, flares, smoke, glow. ' +
  'Moody editorial photography, shallow depth of field, subtle film grain, dark vignette ' +
  'at top and bottom edges, generous negative space in the upper half. ' +
  'ABSOLUTELY NO text, letters, numbers, words, typography, logos, watermarks or signage of any kind.'

const CATEGORY_SCENES: Record<string, string> = {
  nightlife:
    'A packed underground club at peak hour: red laser beams cutting through haze, ' +
    'silhouetted dancers with hands raised, strobe-lit smoke, motion blur, sweat and energy.',
  music:
    'A live concert from the crowd: a burst of red stage light over a sea of raised hands, ' +
    'atmospheric haze, spotlight cones, a lone silhouetted performer.',
  sports:
    'A floodlit stadium at night: dramatic athlete silhouettes mid-motion, ' +
    'red flare smoke drifting across the pitch, charged crowd blur in the background.',
  culture:
    'A dramatic theatre or gallery scene: sculptural chiaroscuro shadows, ' +
    'a single red-lit subject, deep velvet tones, timeless and refined.',
  food:
    'A moody chiaroscuro dinner scene: ember light, smoke rising from a charcoal grill, ' +
    'glistening dishes in deep red and black tones, hands mid-toast.',
  civic:
    'A vast crowd at dusk: red smoke flares, raised fists in silhouette, ' +
    'waving red flags with a black double-headed eagle silhouette, determined faces, ' +
    'dramatic storm-lit sky, revolutionary energy.',
}

const DEFAULT_SCENE =
  'A cinematic city night: red neon reflections on wet streets, silhouetted figures ' +
  'heading somewhere exciting, atmospheric depth.'

export function buildFallbackPrompt(event: PosterEventContext): string {
  const scene =
    (event.category && CATEGORY_SCENES[event.category]) ||
    (event.isCivic ? CATEGORY_SCENES.civic : DEFAULT_SCENE)
  const place = event.country ? `${event.city}, ${event.country}` : event.city
  return `${scene} Set in ${place}. ${BRAND_CANVAS}`
}

const SYSTEM_PROMPT =
  'You are the art director for AlbaGo, an events platform with a strict visual brand: ' +
  'near-black ink (#050505) canvases lit only by flame red (#EE1C25) — red light, neon, ' +
  'smoke, flares. You write prompts for an image-generation model that paints poster ' +
  'BACKDROPS. The event title, date and venue are typeset separately on top of the image, ' +
  'so the image must contain absolutely no text, letters, numbers, logos or signage, and ' +
  'must keep generous dark negative space in the upper half and a darker bottom third. ' +
  'Use everything you know: if the title names a famous artist, band, DJ, festival or ' +
  'movement, draw on your knowledge of their aesthetic, genre and stage presence (never ' +
  'their face or likeness — silhouettes and atmosphere only). If event photos are attached, ' +
  'study them and echo their real setting, subjects, energy and composition so the poster ' +
  'feels like THIS event, not a generic one — but translate everything into the brand ' +
  'palette. Consider the season, the time (a 23:00 club night is not a 12:00 street market), ' +
  'the venue type and the crowd size when setting the scene\'s scale and lighting. ' +
  'Respond with ONE image prompt of 70-130 words and nothing else: a single vivid, specific, ' +
  'cinematic scene, then restate the brand canvas rules (vertical 9:16, ink black base, ' +
  'flame red as the only strong color, film grain, dark vignette, no text of any kind).'

function buildContextText(event: PosterEventContext): string {
  return [
    `Title: ${event.title}`,
    event.category ? `Category: ${event.category}` : null,
    `City: ${event.city}${event.country ? `, ${event.country}` : ''}`,
    event.venueName ? `Venue: ${event.venueName}` : null,
    event.addressHint ? `Meeting point hint: ${event.addressHint}` : null,
    event.date ? `Date: ${event.date}` : null,
    event.time ? `Start time: ${event.time}` : null,
    event.expectedAttendees
      ? `Expected attendance: ~${event.expectedAttendees} people`
      : null,
    event.organizerName ? `Organizer: ${event.organizerName}` : null,
    event.isCivic ? 'This is a civic protest / demonstration event.' : null,
    event.tags?.length ? `Tags: ${event.tags.slice(0, 8).join(', ')}` : null,
    event.description ? `Description: ${event.description.slice(0, 1500)}` : null,
    event.imageUrls?.length
      ? 'The attached photos were uploaded for this exact event — study their setting, subjects and mood.'
      : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildMessages(event: PosterEventContext, withImages: boolean): ModelMessage[] {
  const text = buildContextText(event)
  const images = withImages ? (event.imageUrls ?? []).slice(0, 2) : []
  return [
    {
      role: 'user',
      content: [
        { type: 'text' as const, text },
        ...images.map((url) => ({ type: 'image' as const, image: new URL(url) })),
      ],
    },
  ]
}

async function craftOnce(
  event: PosterEventContext,
  opts: { withImages: boolean; withSearch: boolean },
): Promise<string> {
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    system: SYSTEM_PROMPT,
    messages: buildMessages(event, opts.withImages),
    maxOutputTokens: 2000,
    ...(opts.withSearch
      ? { tools: { google_search: google.tools.googleSearch({}) } }
      : {}),
  })
  return text.trim()
}

/**
 * Craft the backdrop prompt with as much context as the free tier allows.
 * Rungs: photos + search grounding → photos only → text only → deterministic
 * category scene. Poster generation must never die on this step.
 */
export async function craftPosterPrompt(event: PosterEventContext): Promise<string> {
  const fallback = buildFallbackPrompt(event)
  const attempts: Array<{ withImages: boolean; withSearch: boolean }> = [
    // Search grounding is paid-tier-gated; try it, expect it may 4xx.
    { withImages: true, withSearch: true },
    { withImages: true, withSearch: false },
    { withImages: false, withSearch: false },
  ]
  for (const opts of attempts) {
    try {
      const crafted = await craftOnce(event, opts)
      // A too-short answer means the model didn't play along — don't trust it.
      if (crafted.length >= 60) return crafted
    } catch (err) {
      console.error(
        `ai-poster prompt crafting failed (images=${opts.withImages}, search=${opts.withSearch}):`,
        err instanceof Error ? err.message : err,
      )
    }
  }
  return fallback
}
