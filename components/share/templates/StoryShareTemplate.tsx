import type { ShareEventData } from '@/lib/share/types'
import {
  AlbaGoWordmark,
  GridBackdrop,
  categoryLabel,
  ctaLine,
  formatDateForCard,
  formatTimeRangeForCard,
} from './shared'

type Props = {
  data: ShareEventData
  qrDataUrl: string | null
  innerRef?: React.RefObject<HTMLDivElement | null>
}

export default function StoryShareTemplate({ data, qrDataUrl, innerRef }: Props) {
  const date = formatDateForCard(data.date)
  const time = formatTimeRangeForCard(data.time, data.endTime)
  const isCivic = data.isCivic

  return (
    <div
      ref={innerRef}
      className="relative overflow-hidden text-white"
      style={{
        width: 1080,
        height: 1920,
        background: '#050505',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <GridBackdrop />

      <div className="relative z-10 flex h-full flex-col px-20 py-24">
        <div className="flex items-center justify-between">
          <AlbaGoWordmark size="lg" />
          <div
            className="rounded-full px-5 py-2 text-sm font-bold tracking-[0.18em]"
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
        </div>

        <div className="mt-32 flex flex-col gap-8">
          <div
            className="text-[18px] font-bold uppercase tracking-[0.32em]"
            style={{ color: '#ff8a8a' }}
          >
            {date.month} {date.day}
          </div>

          <h1
            className="leading-[0.95]"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 168,
              letterSpacing: '-0.04em',
              color: '#ffffff',
            }}
          >
            {data.city}
          </h1>

          {data.country && (
            <div className="text-[28px] text-white/55" style={{ letterSpacing: '0.04em' }}>
              {data.country}
            </div>
          )}

          <div
            className="mt-2 max-w-[900px] leading-[1.1]"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 64,
              letterSpacing: '-0.02em',
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            {data.title}
          </div>
        </div>

        <div className="mt-auto">
          <div
            className="grid gap-6 rounded-3xl p-10"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-baseline gap-6">
              <div
                className="w-[200px] shrink-0 text-[16px] font-bold uppercase tracking-[0.28em]"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                Date
              </div>
              <div className="text-[34px] font-semibold text-white">
                {date.weekday}, {date.day} {date.month}
              </div>
            </div>

            {time && (
              <div className="flex items-baseline gap-6">
                <div
                  className="w-[200px] shrink-0 text-[16px] font-bold uppercase tracking-[0.28em]"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  Time
                </div>
                <div className="text-[34px] font-semibold text-white tabular-nums">{time}</div>
              </div>
            )}

            {data.address && (
              <div className="flex items-baseline gap-6">
                <div
                  className="w-[200px] shrink-0 text-[16px] font-bold uppercase tracking-[0.28em]"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  Where
                </div>
                <div className="text-[28px] leading-[1.3] text-white/85">{data.address}</div>
              </div>
            )}
          </div>

          <div className="mt-12 flex items-end justify-between gap-10">
            <div className="flex flex-col gap-3">
              <div
                className="text-[18px] font-bold uppercase tracking-[0.28em]"
                style={{ color: '#ff8a8a' }}
              >
                {ctaLine(data)}
              </div>
              <div className="text-[40px] font-semibold tracking-tight text-white">
                albago.org
              </div>
              {data.organizerName && (
                <div className="mt-2 text-[20px] text-white/55">
                  {isCivic ? 'Organized by' : 'Hosted by'} · {data.organizerName}
                </div>
              )}
            </div>

            {qrDataUrl && (
              <div
                className="shrink-0 rounded-2xl p-5"
                style={{ background: '#ffffff' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="QR code"
                  width={220}
                  height={220}
                  style={{ display: 'block' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
