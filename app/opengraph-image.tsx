import { ImageResponse } from 'next/og'

export const alt = 'AlbaGo — Discover Events, Movements & Nightlife'
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
            'radial-gradient(circle at 18% 22%, rgba(238,28,37,0.30), transparent 55%), radial-gradient(circle at 82% 78%, rgba(238,28,37,0.18), transparent 60%)',
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
              boxShadow: '0 0 24px rgba(238,28,37,0.9)',
            }}
          />
          <span
            style={{
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            AlbaGo
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              fontFamily: 'serif',
              fontSize: '128px',
              fontStyle: 'italic',
              lineHeight: 1,
              color: 'white',
              maxWidth: '1000px',
            }}
          >
            <span>Discover what&apos;s&nbsp;</span>
            <span style={{ color: '#ee1c25' }}>happening&nbsp;</span>
            <span>tonight.</span>
          </div>
          <div
            style={{
              fontSize: '28px',
              color: 'rgba(255,255,255,0.7)',
              maxWidth: '900px',
            }}
          >
            Events, nightlife, and peaceful civic gatherings — worldwide.
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
          <span>albago.com</span>
          <span>Live · Mobile-first · Premium</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
