// Turns the seat list copied out of an Eventim account into seat rows, so the
// stock is loaded by pasting instead of typing 37 seats by hand. Eventim's
// "My tickets" view copies as one seat line followed by its category line:
//
//   Nord-Tribüne Oberrang Block 114, Reihe 22, Platz 7
//   Cat 8
//   Dieses Ticket kann zurzeit nicht geteilt oder heruntergeladen werden
//    Einzelticket
//
// Everything that is neither a seat line nor a category line is ignored. A
// category on the same line as the seat (tab-separated table copies) works too.

export type ParsedSeat = {
  category: string
  area: string
  block: string
  row: string
  seat: number
}

export type ParseResult = {
  seats: ParsedSeat[]
  duplicates: number
  /** Lines that looked like seats but could not be read, or seats with no category. */
  problems: string[]
}

const SEAT_RE =
  /^(.+?),\s*(?:Reihe|Row)\s+([^,]+?),\s*(?:Platz|Sitzplatz|Sitz|Seat)\s+(\d{1,4})\b(.*)$/i
const CATEGORY_RE = /\b(?:Cat|Kat|Kategorie|Category)\.?\s*([0-9]{1,3}[A-Z]?|[A-Z])\b/i
const LOOKS_LIKE_SEAT_RE = /\b(?:Reihe|Platz|Row|Seat)\b/i
const TRAILING_BLOCK_RE = /^(.*\S)\s+([0-9]{1,4}(?:\s?[A-Z])?)$/i

/** "Kat. 4" / "Kategorie 4" / "cat 4" → "Cat 4" */
export function normalizeCategory(raw: string): string | null {
  const match = raw.match(CATEGORY_RE)
  return match ? `Cat ${match[1].toUpperCase()}` : null
}

/** "Nord-Tribüne Unterrang Block 20 A" → area + block "20 A";
 *  "Innenraum 204" → area "Innenraum" + block "204". */
export function splitAreaBlock(raw: string): { area: string; block: string } {
  const text = raw.replace(/\s+/g, ' ').trim()
  const blockAt = text.search(/\bBlock\s+/i)
  if (blockAt > 0) {
    return {
      area: text.slice(0, blockAt).trim(),
      block: text.slice(blockAt).replace(/^Block\s+/i, '').trim().toUpperCase(),
    }
  }
  const trailing = text.match(TRAILING_BLOCK_RE)
  if (trailing) {
    return { area: trailing[1].trim(), block: trailing[2].toUpperCase() }
  }
  return { area: text, block: '-' }
}

export function seatKey(seat: Pick<ParsedSeat, 'area' | 'block' | 'row' | 'seat'>): string {
  return `${seat.area}|${seat.block}|${seat.row}|${seat.seat}`.toLowerCase()
}

export function parseEventimSeats(input: string): ParseResult {
  const seats: ParsedSeat[] = []
  const problems: string[] = []
  const seen = new Set<string>()
  let duplicates = 0
  // The seat still waiting for the category line that follows it.
  let pending: (Omit<ParsedSeat, 'category'> & { line: string }) | null = null

  const flushPending = () => {
    if (pending) problems.push(`No category found for: ${pending.line}`)
    pending = null
  }

  const accept = (seat: ParsedSeat) => {
    const key = seatKey(seat)
    if (seen.has(key)) {
      duplicates += 1
      return
    }
    seen.add(key)
    seats.push(seat)
  }

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '  ').trim()
    if (!line) continue

    const seatMatch = line.match(SEAT_RE)
    if (seatMatch) {
      flushPending()
      const { area, block } = splitAreaBlock(seatMatch[1])
      const base = {
        area,
        block,
        row: seatMatch[2].trim().toUpperCase(),
        seat: Number(seatMatch[3]),
      }
      const inlineCategory = normalizeCategory(seatMatch[4] ?? '')
      if (inlineCategory) {
        accept({ ...base, category: inlineCategory })
      } else {
        pending = { ...base, line }
      }
      continue
    }

    const category = normalizeCategory(line)
    // Only a short line is a category line; prose that mentions "Kategorie"
    // must not swallow a seat.
    if (category && line.length <= 24) {
      if (pending) {
        const { area, block, row, seat } = pending
        accept({ area, block, row, seat, category })
        pending = null
      }
      continue
    }

    // Column headers ("Platz") carry no digits; only flag real-looking seats.
    if (LOOKS_LIKE_SEAT_RE.test(line) && /\d/.test(line)) {
      problems.push(`Could not read: ${line}`)
    }
  }
  flushPending()

  return { seats, duplicates, problems }
}

/** One entry per category with a suggested public label (the area of its
 *  first seat), in order of first appearance. */
export function suggestCategories(
  seats: ParsedSeat[],
): Array<{ code: string; label: string; count: number }> {
  const byCode = new Map<string, { code: string; label: string; count: number }>()
  for (const seat of seats) {
    const entry = byCode.get(seat.category)
    if (entry) entry.count += 1
    else byCode.set(seat.category, { code: seat.category, label: seat.area, count: 1 })
  }
  return [...byCode.values()]
}
