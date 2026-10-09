import { ImageResponse } from 'next/og'
import type { HysaLang } from '@/lib/hysa/event'

// Share image for /hysa (phase 44): typographic, no photos or official
// artwork. ?lang=sq|de|en picks the date / kicker language.

const TEXT: Record<HysaLang, { kicker: string; date: string; title: string }> = {
  sq: { kicker: 'SHQIPËRIA NË SKENËN E MADHE', date: '28 NËNTOR 2026', title: 'KAMPIONATI BOTËROR WBC' },
  de: { kicker: 'ALBANIEN AUF DER GROSSEN BÜHNE', date: '28. NOVEMBER 2026', title: 'WBC-WELTMEISTERSCHAFT' },
  en: { kicker: 'ALBANIA ON THE BIG STAGE', date: '28 NOVEMBER 2026', title: 'WBC WORLD CHAMPIONSHIP' },
}

export async function GET(request: Request) {
  const param = new URL(request.url).searchParams.get('lang')
  const lang: HysaLang = param === 'de' || param === 'en' ? param : 'sq'
  const t = TEXT[lang]
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          backgroundColor: '#050505',
          backgroundImage: 'linear-gradient(135deg, rgba(238,28,37,0.55) 0%, rgba(5,5,5,1) 62%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 6, color: '#fecaca' }}>{t.kicker}</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, letterSpacing: 14, color: 'rgba(255,255,255,0.75)' }}>NELSON</div>
          <div style={{ display: 'flex', fontSize: 196, fontWeight: 900, lineHeight: 0.9, letterSpacing: -6 }}>HYSA</div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 12 }}>
            <span style={{ fontSize: 48, fontStyle: 'italic', color: '#f87171', marginRight: 22 }}>vs</span>
            <span style={{ fontSize: 58, fontWeight: 900, color: 'rgba(255,255,255,0.6)' }}>AGIT KABAYEL</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 28, fontWeight: 700 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>{t.title}</span>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{t.date} · MERKUR SPIEL-ARENA · DÜSSELDORF</span>
          </div>
          <span style={{ display: 'flex', fontSize: 34, fontWeight: 800 }}>
            Alba<span style={{ color: '#ee1c25', fontStyle: 'italic' }}>Go</span>
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
    },
  )
}
