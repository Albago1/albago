import { google } from '@ai-sdk/google'

/**
 * The one text model used for AI art direction and captions.
 *
 * gemini-flash-lite-latest is Google's rolling alias for the current
 * Flash-Lite model — concrete IDs get retired without warning
 * (gemini-2.5-flash started 404ing in July 2026 while still appearing in
 * the models list), and the full Flash models 503 under free-tier
 * deprioritization. Lite is plenty for art direction + captions.
 * Override with AI_TEXT_MODEL if a specific pin is ever needed.
 */
export function textModel() {
  return google(process.env.AI_TEXT_MODEL || 'gemini-flash-lite-latest')
}
