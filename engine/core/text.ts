// Moved from lib/mapSearch.ts (Phase 0 B4).

// Accent-insensitive fold that PRESERVES string length, so match positions
// on the folded string can be used to highlight the original: each character
// folds independently to its base letter ("ë" → "e", "Ç" → "c"). The plain
// multi-char fold() used elsewhere can shift indices via NFD expansion.
const foldCharCache = new Map<string, string>()

function foldChar(ch: string): string {
  let folded = foldCharCache.get(ch)
  if (folded === undefined) {
    folded =
      ch
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')[0] ?? ch.toLowerCase()
    foldCharCache.set(ch, folded)
  }
  return folded
}

export function foldText(value: string): string {
  let out = ''
  for (const ch of value) out += foldChar(ch)
  return out
}
