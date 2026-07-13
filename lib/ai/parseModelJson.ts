/**
 * Strip the markdown fences models sometimes wrap around JSON replies and
 * parse. Returns null on unparseable output — callers treat that as a model
 * failure and fall back. One shared implementation so the poster reader, URL
 * reader, translator, and caption writer can't drift.
 */
export function parseModelJson(raw: string): unknown | null {
  try {
    return JSON.parse(
      raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, ''),
    )
  } catch {
    return null
  }
}
