import type { ShareEventData } from '@/lib/share/types'

export function formatDateForCard(iso: string): { weekday: string; day: string; month: string } {
  const d = new Date(`${iso}T12:00:00`)
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()
  const day = d.toLocaleDateString('en-GB', { day: 'numeric' })
  const month = d.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase()
  return { weekday, day, month }
}

export function formatTimeRangeForCard(time: string | null, endTime: string | null): string {
  if (!time) return ''
  return endTime ? `${time} – ${endTime}` : time
}

export function categoryLabel(data: ShareEventData): string {
  if (data.isCivic) return 'CONFIRMED PROTEST'
  const c = (data.category || 'EVENT').toUpperCase()
  return c
}

export function locationLine(data: ShareEventData): string {
  return `${data.city}${data.country ? `, ${data.country}` : ''}`
}

/* Short address — keep the first segment of the comma-separated address
   (usually the street + number or the named landmark). The city + country
   are already shown big in their own slot, so a full "Street, 10969 Berlin,
   Germany" line is redundant and wraps badly on the cards.

   "Trafalgar Square, London, UK"            → "Trafalgar Square"
   "Prinzenstraße 85, 10969 Berlin, Germany" → "Prinzenstraße 85"
   "Brandenburger Tor"                       → "Brandenburger Tor" */
export function shortAddress(address: string | null): string | null {
  if (!address) return null
  const first = address.split(',')[0]?.trim()
  if (!first || first.length < 3) return address.trim()
  return first
}

export function ctaLine(data: ShareEventData): string {
  return data.isCivic ? 'Details on AlbaGo' : 'Discover more on AlbaGo'
}

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
            fontFamily: "'Instrument Serif', Georgia, serif",
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

export function GridBackdrop() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(238,28,37,0.30) 0%, rgba(0,0,0,0) 70%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(40% 35% at 50% 100%, rgba(238,28,37,0.18) 0%, rgba(0,0,0,0) 70%)',
        }}
      />
    </>
  )
}

/* Flamingo motif — ported from the /protests hero SVG, gradients flattened
   to solid fills (no <defs>) so html-to-image renders deterministically and
   we never collide IDs when all three templates render in the same off-screen
   container. Tinted to sit BEHIND the foreground text at lower opacity. */
type FlamingoMotifProps = {
  width: number
  opacity?: number
}

export function FlamingoMotif({ width, opacity = 0.55 }: FlamingoMotifProps) {
  const height = (width * 300) / 200
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 300"
      aria-hidden="true"
      style={{ opacity, pointerEvents: 'none' }}
    >
      {/* Tail feathers */}
      <path d="M 22,165 L 0,138 L 10,172 L -4,180 L 22,195 Z" fill="#fda4af" fillOpacity={0.45} />

      {/* Body */}
      <ellipse cx="80" cy="170" rx="58" ry="42" fill="#f9a8d4" fillOpacity={0.42} />

      {/* Wing patch */}
      <path d="M 48,162 Q 80,142 112,166 Q 82,184 48,162 Z" fill="#ec4899" fillOpacity={0.32} />

      {/* Wing feather strokes */}
      <path
        d="M 56,156 Q 76,150 100,162 M 54,166 Q 78,162 104,172 M 54,176 Q 78,175 105,180"
        stroke="#f472b6"
        strokeWidth={1.6}
        strokeOpacity={0.65}
        fill="none"
        strokeLinecap="round"
      />

      {/* Neck S-curve */}
      <path
        d="M 115,140 C 155,100 80,80 130,30"
        fill="none"
        stroke="#f9a8d4"
        strokeWidth={18}
        strokeLinecap="round"
        strokeOpacity={0.55}
      />

      {/* Head */}
      <circle cx="135" cy="28" r="16" fill="#f9a8d4" fillOpacity={0.6} />

      {/* Beak upper */}
      <path d="M 150,32 L 178,46 L 152,52 Z" fill="#fda4af" fillOpacity={0.7} />

      {/* Beak tip */}
      <path d="M 162,48 L 178,46 L 168,58 Z" fill="#0a0a0f" fillOpacity={0.75} />

      {/* Eye */}
      <circle cx="138" cy="22" r="2.6" fill="#0a0a0f" fillOpacity={0.85} />

      {/* Standing leg */}
      <rect x="76" y="208" width={5} height={80} rx={2.5} fill="#f9a8d4" fillOpacity={0.5} />
      <ellipse cx="78" cy="290" rx={14} ry={3} fill="#ec4899" fillOpacity={0.32} />

      {/* Folded leg */}
      <line
        x1="100"
        y1="208"
        x2="110"
        y2="248"
        stroke="#f9a8d4"
        strokeWidth={5}
        strokeLinecap="round"
        strokeOpacity={0.5}
      />
      <line
        x1="110"
        y1="248"
        x2="82"
        y2="238"
        stroke="#f9a8d4"
        strokeWidth={5}
        strokeLinecap="round"
        strokeOpacity={0.5}
      />
    </svg>
  )
}

/* Soft pink halo behind the flamingo — matches the protests page glow. */
export function FlamingoHalo({ size }: { size: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '9999px',
        background:
          'radial-gradient(circle, rgba(236,72,153,0.22) 0%, rgba(236,72,153,0) 65%)',
        pointerEvents: 'none',
      }}
    />
  )
}
