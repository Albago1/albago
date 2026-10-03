import type { ShareEventData } from '@/lib/share/types'
import {
  AlbaGoWordmark,
  DateHero,
  InkBackdrop,
  categoryLabel,
  CTA_LINE,
  fitSize,
  inkGlyph,
  formatTimeRangeForCard,
  locationLine,
  shortAddress,
} from './shared'

type Props = {
  data: ShareEventData
  qrDataUrl: string | null
  innerRef?: React.RefObject<HTMLDivElement | null>
  /** Backdrop artwork (data URL) painted behind the typography. */
  backdropUrl?: string | null
}

export default function FacebookShareTemplate({ data, qrDataUrl, innerRef, backdropUrl }: Props) {
  const time = formatTimeRangeForCard(data.time, data.endTime)
  const where = shortAddress(data.address)

  return (
    <div
      ref={innerRef}
      className="relative overflow-hidden text-white"
      style={{
        width: 1200,
        height: 630,
        background: '#050505',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      {backdropUrl ? (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backdropUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Scrim so the typography stays readable over any art. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, rgba(5,5,5,0.82) 0%, rgba(5,5,5,0.46) 55%, rgba(5,5,5,0.66) 100%)',
            }}
          />
        </div>
      ) : (
        <InkBackdrop glyph={inkGlyph(data.title)} glyphSize={560} glyphRight="10%" glyphTop="48%" />
      )}

      <div className="relative z-10 grid h-full grid-cols-[auto_1fr_auto] items-stretch gap-10 px-16 py-12">
        <div className="flex flex-col justify-center">
          <DateHero iso={data.date} endIso={data.endDate} scale="sm" />
        </div>

        <div className="flex flex-col">
          <AlbaGoWordmark size="sm" />

          <div className="mt-6">
            <div
              className="inline-block rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.18em]"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {categoryLabel(data)}
            </div>
          </div>

          <h1
            className="mt-5 leading-[0.95]"
            style={{
              fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif",
              fontSize: fitSize(data.title, 72, 50, 42),
              letterSpacing: '-0.03em',
              color: '#ffffff',
              textShadow: '0 3px 22px rgba(5,5,5,0.85)',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {data.title}
          </h1>

          <div className="mt-auto flex flex-col gap-1.5">
            {where ? (
              <>
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-flame-300/80">
                  {'Meeting point'}
                </div>
                <div className="text-[22px] font-semibold leading-[1.2] text-white">
                  📍 {where}
                </div>
                <div className="text-[15px] font-medium text-white/60 tabular-nums">
                  {locationLine(data)}
                  {time && <span className="ml-3 text-white/50">· {time}</span>}
                </div>
              </>
            ) : (
              <div className="text-[18px] font-semibold text-white tabular-nums">
                📍 {locationLine(data)}
                {time && <span className="ml-4 text-white/60">· {time}</span>}
              </div>
            )}
            <div
              className="mt-1 text-[13px] font-bold uppercase tracking-[0.28em]"
              style={{ color: '#ff8a8a' }}
            >
              {CTA_LINE} · albago.org
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end justify-between">
          {qrDataUrl ? (
            <div
              className="rounded-2xl p-3"
              style={{ background: '#ffffff' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR code"
                width={130}
                height={130}
                style={{ display: 'block' }}
              />
            </div>
          ) : (
            <div />
          )}

          <div
            className="text-right text-[18px] leading-[1.1]"
            style={{
              fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif",
              letterSpacing: '-0.02em',
            }}
          >
            <div className="text-white/55">
              {'Scan to open'}
            </div>
            <div className="text-white">{data.city}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
