import { ImageResponse } from 'next/og'

export const alt = 'Volunteer — AlbaGo'
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
            'radial-gradient(circle at 80% 22%, rgba(238,28,37,0.35), transparent 60%), radial-gradient(circle at 20% 80%, rgba(238,28,37,0.20), transparent 55%)',
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
            AlbaGo · Volunteer
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              fontFamily: 'serif',
              fontSize: '124px',
              lineHeight: 1,
              color: 'white',
              maxWidth: '1050px',
            }}
          >
            <span>A few hours&nbsp;</span>
            <span style={{ fontStyle: 'italic', color: '#ee1c25' }}>
              moves the movement
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
            Marshal, translate, design, drive, observe. Pick what fits — we coordinate the rest.
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
          <span>albago.com/volunteer</span>
          <span>Open · Lawful · Peaceful</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
