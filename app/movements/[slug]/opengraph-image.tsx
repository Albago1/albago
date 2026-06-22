import { ImageResponse } from 'next/og'
import { getMovementBySlug } from '@/lib/movements'

export const alt = 'Movement — AlbaGo'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Params = { slug: string }

export default async function Image({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const movement = getMovementBySlug(slug)
  const name = movement?.name ?? 'A peaceful movement'
  const tagline = movement?.tagline ?? 'Coordinated through AlbaGo.'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#050505',
          backgroundImage:
            'radial-gradient(circle at 22% 24%, rgba(238,28,37,0.45), transparent 60%), radial-gradient(circle at 78% 78%, rgba(238,28,37,0.25), transparent 55%)',
          padding: '72px',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '999px',
              background: '#ee1c25',
              boxShadow: '0 0 28px rgba(238,28,37,0.95)',
            }}
          />
          <span
            style={{
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            AlbaGo · Movement
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              fontFamily: 'serif',
              fontSize: '116px',
              lineHeight: 1,
              color: 'white',
              maxWidth: '1050px',
            }}
          >
            <span>{name} —&nbsp;</span>
            <span style={{ fontStyle: 'italic', color: '#ee1c25' }}>
              {tagline}
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: '22px',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          <span>albago.org/movements/{slug}</span>
          <span>Peaceful · Lawful · Worldwide</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
