import { ImageResponse } from 'next/og'

export const alt = 'Protests Worldwide — AlbaGo'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
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
            'radial-gradient(circle at 22% 24%, rgba(238,28,37,0.40), transparent 60%), radial-gradient(circle at 78% 80%, rgba(238,28,37,0.22), transparent 55%)',
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
            AlbaGo · Protests
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              fontFamily: 'serif',
              fontSize: '132px',
              lineHeight: 1,
              color: 'white',
              maxWidth: '1050px',
            }}
          >
            <span>Find a protest&nbsp;</span>
            <span style={{ fontStyle: 'italic', color: '#ee1c25' }}>
              anywhere
            </span>
            <span>.</span>
          </div>
          <div
            style={{
              fontSize: '30px',
              color: 'rgba(255,255,255,0.72)',
              maxWidth: '950px',
            }}
          >
            A live worldwide directory of peaceful civic gatherings. Coordinated through AlbaGo.
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
          <span>albago.com/protests</span>
          <span>Peaceful · Lawful · Family-friendly</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
