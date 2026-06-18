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

export function ctaLine(data: ShareEventData): string {
  return data.isCivic ? 'Details on AlbaGo' : 'Discover more on AlbaGo'
}

export function AlbaGoWordmark({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const monoSize =
    size === 'lg' ? 'h-14 w-14 text-2xl' : size === 'md' ? 'h-11 w-11 text-xl' : 'h-9 w-9 text-base'
  const wordSize = size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-3xl' : 'text-2xl'
  return (
    <div className="inline-flex items-center gap-4">
      <div
        className={`${monoSize} flex items-center justify-center rounded-2xl font-black text-white`}
        style={{
          background: 'linear-gradient(135deg, #ff3a45 0%, #ee1c25 50%, #b80016 100%)',
          boxShadow: '0 10px 30px -10px rgba(238,28,37,0.6)',
        }}
      >
        AG
      </div>
      <div
        className={`${wordSize} font-semibold tracking-tight text-white`}
        style={{ fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: '-0.02em' }}
      >
        AlbaGo
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
