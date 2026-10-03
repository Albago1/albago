import type { CSSProperties } from 'react'
import type { ShareEventData } from '@/lib/share/types'
import { formatEventTimeLabel } from '@/lib/dateFilters'

export function formatDateForCard(iso: string): { weekday: string; day: string; month: string } {
  const d = new Date(`${iso}T12:00:00`)
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()
  const day = d.toLocaleDateString('en-GB', { day: 'numeric' })
  const month = d.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase()
  return { weekday, day, month }
}


/* Length-aware type size. Text up to `comfortable` characters renders at
   `base`; longer text scales down proportionally, floored at `min`, so a
   long title or city name shrinks gracefully instead of overflowing the
   fixed-size poster frame. */
export function fitSize(
  text: string | null | undefined,
  base: number,
  min: number,
  comfortable: number,
): number {
  const len = (text ?? '').trim().length
  if (len <= comfortable) return base
  return Math.max(min, Math.round((base * comfortable) / len))
}

/** True when the event runs continuously across more than one calendar day. */
export function isMultiDayRange(iso: string, endIso: string | null | undefined): endIso is string {
  return !!endIso && endIso > iso
}

/* Date hero block — big day number + month / weekday underneath. For a multi-day event a "→ <end day> <end month>" line is appended so the
   whole span reads at a glance instead of a single misleading day. Three
   scales tuned to the three templates' canvas sizes. */
export function DateHero({
  iso,
  endIso,
  scale,
}: {
  iso: string
  endIso?: string | null
  scale: 'sm' | 'md' | 'lg'
}) {
  const d = new Date(`${iso}T12:00:00`)
  const day = d.toLocaleDateString('en-GB', { day: 'numeric' })
  const monthEn = d.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase()
  const weekdayEn = d.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase()

  const numberSize = scale === 'lg' ? 180 : scale === 'md' ? 130 : 90
  const monthSize = scale === 'lg' ? 28 : scale === 'md' ? 22 : 16
  const weekdaySize = scale === 'lg' ? 22 : scale === 'md' ? 18 : 13
  const gap = scale === 'sm' ? 6 : 12

  const numberStyle: CSSProperties = {
    fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif",
    fontSize: numberSize,
    lineHeight: 0.82,
    letterSpacing: '-0.04em',
    color: '#ff5757',
    textShadow: '0 6px 32px rgba(238,28,37,0.55)',
  }

  // One day block: the big serif day number, month + weekday underneath.
  const dayBlock = (dd: string, mm: string, ww: string) => (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        lineHeight: 1,
      }}
    >
      <div style={numberStyle}>{dd}</div>
      <div
        style={{
          marginTop: gap + 4,
          fontSize: monthSize,
          fontWeight: 800,
          letterSpacing: '0.16em',
          color: '#ffffff',
        }}
      >
        {mm}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: weekdaySize,
          fontWeight: 600,
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        {ww}
      </div>
    </div>
  )

  if (!isMultiDayRange(iso, endIso)) {
    return dayBlock(day, monthEn, weekdayEn)
  }

  // Multi-day: the last day gets a day block just as large as the first, sitting
  // right beside it with a dash between — the whole span reads at a glance.
  // English-only labels keep the pair from getting too wide.
  const e = new Date(`${endIso}T12:00:00`)
  const endDay = e.toLocaleDateString('en-GB', { day: 'numeric' })
  const endMonthEn = e.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase()
  const endWeekdayEn = e.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase()

  return (
    <div style={{ display: 'inline-flex', alignItems: 'flex-start', gap: gap * 1.4 }}>
      {dayBlock(day, monthEn, weekdayEn)}
      <div style={{ ...numberStyle, color: 'rgba(255,87,87,0.75)' }}>–</div>
      {dayBlock(endDay, endMonthEn, endWeekdayEn)}
    </div>
  )
}

/* Full date value for the info-card "Date" row. Single day keeps the existing
   "THU, 9 JULY" form; a multi-day event shows the whole span:
   "9 – 12 JULY" (same month) or "31 JULY – 2 AUGUST" (crossing months). */
export function cardDateValue(data: ShareEventData): string {
  const start = formatDateForCard(data.date)
  if (!isMultiDayRange(data.date, data.endDate)) {
    return `${start.weekday}, ${start.day} ${start.month}`
  }
  const end = formatDateForCard(data.endDate)
  const sameMonth = data.date.slice(0, 7) === data.endDate.slice(0, 7)
  return sameMonth
    ? `${start.day} – ${end.day} ${start.month}`
    : `${start.day} ${start.month} – ${end.day} ${end.month}`
}

export function formatTimeRangeForCard(time: string | null, endTime: string | null): string {
  if (!time) return ''
  const start = formatEventTimeLabel(time)
  const end = formatEventTimeLabel(endTime)
  return end ? `${start} – ${end}` : start
}

export function categoryLabel(data: ShareEventData): string {
  const c = (data.category || 'EVENT').toUpperCase()
  return c
}

export function locationLine(data: ShareEventData): string {
  return `${data.city}${data.country ? `, ${data.country}` : ''}`
}

/* Short address — keep everything except the country segment so the reader
   still gets street + postal + city (the part they actually need on the
   ground), without the country which is already shown big elsewhere.

   "Trafalgar Square, London, UK"            → "Trafalgar Square, London"
   "Prinzenstraße 85, 10969 Berlin, Germany" → "Prinzenstraße 85, 10969 Berlin"
   "Place de la Bastille, 75011 Paris, FR"   → "Place de la Bastille, 75011 Paris"
   "Brandenburger Tor"                       → "Brandenburger Tor"
   "Berlin, Germany"                         → "Berlin, Germany" */
export function shortAddress(address: string | null): string | null {
  if (!address) return null
  const segments = address.split(',').map((s) => s.trim()).filter(Boolean)
  if (segments.length === 0) return null
  if (segments.length <= 2) return segments.join(', ')
  return segments.slice(0, -1).join(', ')
}

export const CTA_LINE = 'Discover more on AlbaGo'

/* AlbaGo wordmark — matches LandingNavbar exactly: red rounded square with
   a white MapPin pin, then "Alba" bold sans + "Go" in Instrument Serif italic
   flame red. Three sizes scale the icon block + wordmark together. */
export function AlbaGoWordmark({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box =
    size === 'lg' ? 80 : size === 'md' ? 60 : 44
  const pin =
    size === 'lg' ? 44 : size === 'md' ? 32 : 24
  const wordSize =
    size === 'lg' ? 64 : size === 'md' ? 46 : 32
  const radius =
    size === 'lg' ? 22 : size === 'md' ? 16 : 12

  return (
    <div className="inline-flex items-center gap-5">
      <div
        className="flex items-center justify-center"
        style={{
          width: box,
          height: box,
          borderRadius: radius,
          background: '#ee1c25',
          boxShadow: '0 0 60px -8px rgba(238,28,37,0.55)',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={pin}
          height={pin}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <div
        style={{
          fontSize: wordSize,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#ffffff',
          lineHeight: 1,
        }}
      >
        Alba
        <span
          style={{
            fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif",
            fontStyle: 'italic',
            fontWeight: 400,
            color: '#ee1c25',
          }}
        >
          Go
        </span>
      </div>
    </div>
  )
}

/* Ink backdrop — the no-photo look for events. Editorial rather than techy: a deep black field with
   ember blooms rising from the lower-left, faint concentric light rings from
   the same source, one diagonal sheen, and a giant ghosted Instrument Serif
   monogram — the event title's initial — so every Ink poster is unique.
   Pure CSS gradients (no SVG <defs>) so html-to-image renders it
   deterministically even with all three templates mounted at once. */
export function InkBackdrop({
  glyph,
  glyphSize,
  glyphRight = '-4%',
  glyphTop = '44%',
}: {
  glyph: string
  glyphSize: number
  glyphRight?: string
  glyphTop?: string
}) {
  return (
    <>
      {/* ember blooms — one strong source low-left, two faint echoes */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(58% 44% at 16% 106%, rgba(238,28,37,0.36) 0%, rgba(238,28,37,0) 70%), ' +
            'radial-gradient(48% 36% at 90% -8%, rgba(238,28,37,0.14) 0%, rgba(238,28,37,0) 70%), ' +
            'radial-gradient(32% 24% at 80% 86%, rgba(255,122,92,0.10) 0%, rgba(255,122,92,0) 70%)',
        }}
      />
      {/* concentric light rings radiating from the bloom */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-radial-gradient(circle at 16% 106%, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 120px)',
        }}
      />
      {/* one diagonal sheen — a projector beam across the black */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%)',
        }}
      />
      {/* ghost monogram — the event's initial, oversized serif italic */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: glyphRight,
          top: glyphTop,
          transform: 'translateY(-50%)',
          fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif",
          fontStyle: 'italic',
          fontSize: glyphSize,
          lineHeight: 0.8,
          color: 'rgba(238,28,37,0.06)',
          WebkitTextStroke: '2px rgba(238,28,37,0.17)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {glyph}
      </div>
    </>
  )
}

/** The ghost monogram for the Ink backdrop — the title's first letter. */
export function inkGlyph(title: string): string {
  const ch = (title || '').trim().charAt(0).toUpperCase()
  return /[A-ZÀ-ÿ0-9]/.test(ch) ? ch : 'A'
}

