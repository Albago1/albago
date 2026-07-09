import { generateText } from 'ai'

/**
 * Art direction for AI-generated share-poster backdrops.
 *
 * The image model paints ONLY the atmosphere — every word on the poster
 * (title, date, venue, QR) is rendered by the existing share templates.
 * Image models produce broken text, so the prompt forbids it outright and
 * asks for negative space where the template's typography lands.
 */

export type PosterEventContext = {
  title: string
  description: string | null
  category: string | null
  city: string
  country: string | null
  isCivic: boolean
  tags: string[] | null
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

/**
 * Ask a small text model to art-direct the backdrop from the event's own
 * words. Falls back to the deterministic category scene on any failure —
 * poster generation must never die on the prompt-crafting step.
 */
export async function craftPosterPrompt(event: PosterEventContext): Promise<string> {
  const fallback = buildFallbackPrompt(event)
  try {
    const context = [
      `Title: ${event.title}`,
      event.category ? `Category: ${event.category}` : null,
      `City: ${event.city}${event.country ? `, ${event.country}` : ''}`,
      event.isCivic ? 'This is a civic protest / demonstration event.' : null,
      event.tags?.length ? `Tags: ${event.tags.slice(0, 8).join(', ')}` : null,
      event.description
        ? `Description: ${event.description.slice(0, 900)}`
        : null,
    ]
      .filter(Boolean)
      .join('\n')

    const { text } = await generateText({
      model: 'anthropic/claude-haiku-4.5',
      system:
        'You are the art director for AlbaGo, an events platform with a strict visual brand: ' +
        'near-black ink (#050505) canvases lit only by flame red (#EE1C25) — red light, neon, ' +
        'smoke, flares. You write prompts for an image-generation model that paints poster ' +
        'BACKDROPS. The event title, date and venue are typeset separately on top of the image, ' +
        'so the image must contain absolutely no text, letters, numbers, logos or signage, and ' +
        'must keep generous dark negative space in the upper half and a darker bottom third. ' +
        'Respond with ONE image prompt of 60-110 words and nothing else: describe a single vivid, ' +
        'cinematic scene that captures the specific mood of the event (use concrete details from ' +
        'its description), then restate the brand canvas rules (vertical 9:16, ink black base, ' +
        'flame red as the only strong color, film grain, dark vignette, no text of any kind).',
      prompt: context,
      maxOutputTokens: 300,
    })

    const cleaned = text.trim()
    // A too-short answer means the model didn't play along — don't trust it.
    return cleaned.length >= 60 ? cleaned : fallback
  } catch (err) {
    console.error('ai-poster prompt crafting failed, using fallback:', err)
    return fallback
  }
}
