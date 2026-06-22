import { ImageResponse } from 'next/og'

export const alt = 'Albanian Revolution — Peaceful Worldwide Movement'
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
            'radial-gradient(circle at 20% 18%, rgba(238,28,37,0.50), transparent 55%), radial-gradient(circle at 78% 78%, rgba(238,28,37,0.30), transparent 60%)',
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
              boxShadow: '0 0 32px rgba(238,28,37,1)',
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
            AlbaGo · Featured Movement
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
            <span>Albanian Revolution —&nbsp;</span>
            <span style={{ fontStyle: 'italic', color: '#ee1c25' }}>
              a peaceful, worldwide movement
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
            Tirana · Prishtina · Diaspora. Open organizing. Lawful. Family-friendly.
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
          <span>albago.org/events/albanian-revolution</span>
          <span>Add your city.</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
