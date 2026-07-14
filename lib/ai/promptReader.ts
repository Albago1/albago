import { generateText } from 'ai'
import { textModel } from './textModel'
import { parseModelJson } from './parseModelJson'
import {
  coercePosterReading,
  LENS_JSON_SHAPE,
  type PosterReading,
} from './posterReader'

/**
 * AlbaGo Lens (task U-01): reads an event from the user's OWN free-text
 * description — "jazz night at Hemingway Bar this Friday, 21:00, free entry"
 * — and extracts the same structured reading a poster photo or pasted URL
 * would. Third input mode into the shared Lens pipeline: same JSON contract,
 * same resolution + translation enrichment, same result card, same wizard
 * draft, same review-before-submit and moderation queue. Nothing publishes
 * from a prompt without human confirmation.
 *
 * Same contract as the other readers: extraction only, NEVER invent. A field
 * the person didn't state comes back empty and they fill it in the wizard.
 */

const MAX_PROMPT_CHARS = 4000

const SYSTEM_PROMPT = `You read a person's own free-text description of an event they want to publish (any language — Albanian, English, German, Spanish, Italian) and extract it as strict JSON.

Rules:
1. NEVER invent information. If the description does not state a field, return "" (or [] for lists). The person reviews and completes the draft afterwards — an empty field is correct, a guessed one damages trust. Do not embellish.
2. description: rewrite the person's own wording as 1–4 clean sentences in the SAME language they wrote in. Only facts they stated — no marketing additions, no invented details.
3. Dates: resolve relative expressions ("next Friday", "nesër", "të shtunën", "übermorgen", "mañana") to ISO YYYY-MM-DD using the reference date you are given. Month names may be Albanian (janar, shkurt, mars, prill, maj, qershor, korrik, gusht, shtator, tetor, nëntor, dhjetor), German, Spanish, or Italian. If a year is missing, assume the next occurrence. If no date is stated, return "".
4. Times: 24h HH:MM. Prefer the start time over doors.
5. category: exactly one of nightlife, music, sports, culture, food, civic — or "" if unclear. Protests, marches, commemorations, civic assemblies → civic and is_civic true.
6. price: exactly as stated, including currency. Free → the person's own wording.
7. language: the description's main language as one of en, sq, de, es, it, fr (closest match).
8. tags: up to 5 lowercase single words (genre, scene, occasion).
9. artists: performer/speaker names if the person named any, largest billing first.
10. is_event: false when the text is not describing a single real-world event (a question, a complaint, a business ad with no event in it). Vague or very thin descriptions get low confidence — be honest, the UI warns the user.

Return ONLY a JSON object with exactly these keys:
${LENS_JSON_SHAPE}
No markdown fences, no commentary.`

/**
 * Extract a structured event from a free-text description. Returns null when
 * the model output is unusable.
 */
export async function readEventFromPrompt(
  promptText: string,
  todayIso: string,
): Promise<PosterReading | null> {
  const { text } = await generateText({
    model: textModel(),
    system: SYSTEM_PROMPT,
    prompt: `Reference date (today): ${todayIso}.\n\nEvent description:\n${promptText.slice(0, MAX_PROMPT_CHARS)}`,
    maxOutputTokens: 1600,
  })

  return coercePosterReading(parseModelJson(text))
}
