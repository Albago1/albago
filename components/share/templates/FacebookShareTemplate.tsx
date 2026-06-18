import type { ShareEventData } from '@/lib/share/types'
import {
  AlbaGoWordmark,
  GridBackdrop,
  categoryLabel,
  ctaLine,
  formatDateForCard,
  formatTimeRangeForCard,
  locationLine,
} from './shared'

type Props = {
  data: ShareEventData
  qrDataUrl: string | null
  innerRef?: React.RefObject<HTMLDivElement | null>
}

export default function FacebookShareTemplate({ data, qrDataUrl, innerRef }: Props) {
  const date = formatDateForCard(data.date)
  const time = formatTimeRangeForCard(data.time, data.endTime)
  const isCivic = data.isCivic

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
      <GridBackdrop />

      <div className="relative z-10 grid h-full grid-cols-[1fr_auto] items-stretch gap-12 px-16 py-12">
        <div className="flex flex-col">
          <AlbaGoWordmark size="sm" />

          <div className="mt-8 flex items-center gap-3">
            <div
              className="rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.18em]"
              style={{
                background: isCivic ? 'rgba(238,28,37,0.18)' : 'rgba(255,255,255,0.08)',
                color: isCivic ? '#ff8a8a' : 'rgba(255,255,255,0.85)',
                border: isCivic
                  ? '1px solid rgba(238,28,37,0.45)'
                  : '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {categoryLabel(data)}
            </div>
            <div
              className="text-[14px] font-bold uppercase tracking-[0.28em]"
              style={{ color: '#ff8a8a' }}
            >
              {date.weekday}, {date.day} {date.month}
            </div>
          </div>

          <h1
            className="mt-6 leading-[0.95]"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 72,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {data.title}
          </h1>

          <div className="mt-auto flex flex-col gap-2">
            <div className="text-[18px] font-semibold text-white/80 tabular-nums">
              📍 {locationLine(data)}
              {time && <span className="ml-4 text-white/60">🕒 {time}</span>}
            </div>
            <div
              className="text-[13px] font-bold uppercase tracking-[0.28em]"
              style={{ color: '#ff8a8a' }}
            >
              {ctaLine(data)} · albago.org
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
              fontFamily: "'Instrument Serif', Georgia, serif",
              letterSpacing: '-0.02em',
            }}
          >
            <div className="text-white/55">Scan to open</div>
            <div className="text-white">{data.city}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
