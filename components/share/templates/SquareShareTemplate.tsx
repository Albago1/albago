import type { ShareEventData } from '@/lib/share/types'
import {
  AlbaGoWordmark,
  DateHero,
  FlamingoHalo,
  FlamingoMotif,
  GridBackdrop,
  bilingualLabel,
  categoryLabel,
  ctaLine,
  formatTimeRangeForCard,
  shortAddress,
} from './shared'

type Props = {
  data: ShareEventData
  qrDataUrl: string | null
  innerRef?: React.RefObject<HTMLDivElement | null>
}

export default function SquareShareTemplate({ data, qrDataUrl, innerRef }: Props) {
  const time = formatTimeRangeForCard(data.time, data.endTime)
  const isCivic = data.isCivic
  const where = shortAddress(data.address)

  return (
    <div
      ref={innerRef}
      className="relative overflow-hidden text-white"
      style={{
        width: 1080,
        height: 1080,
        background: '#050505',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <GridBackdrop />

      {/* Flamingo motif — centered behind the foreground content. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FlamingoHalo size={620} />
        <div style={{ position: 'relative' }}>
          <FlamingoMotif width={420} opacity={0.45} />
        </div>
      </div>

      <div className="relative z-10 flex h-full flex-col px-20 py-20">
        <div className="flex items-center justify-between">
          <AlbaGoWordmark size="md" />
          <div
            className="rounded-full px-4 py-1.5 text-xs font-bold tracking-[0.18em]"
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

        <div className="mt-10 flex flex-1 flex-col justify-center">
          <DateHero iso={data.date} isCivic={isCivic} scale="md" />

          <h1
            className="mt-8 leading-[0.92]"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 120,
              letterSpacing: '-0.04em',
              color: '#ffffff',
              textShadow: '0 4px 30px rgba(5,5,5,0.85)',
            }}
          >
            {data.city}
          </h1>

          <div
            className="mt-6 max-w-[820px] leading-[1.15]"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 44,
              letterSpacing: '-0.02em',
              color: 'rgba(255,255,255,0.92)',
              textShadow: '0 3px 24px rgba(5,5,5,0.85)',
            }}
          >
            {data.title}
          </div>

          {(time || where || data.country) && (
            <div className="mt-10 flex flex-col gap-3">
              {time && (
                <div className="text-[26px] font-semibold text-white/85 tabular-nums">
                  🕒 {time}
                </div>
              )}
              {where && (
                <div className="flex max-w-[860px] flex-col gap-1.5">
                  <div className="text-[12px] font-bold uppercase tracking-[0.24em] text-flame-300/80">
                    {bilingualLabel('Pika e takimit', 'Meeting point', isCivic)}
                  </div>
                  <div className="text-[28px] font-semibold leading-[1.25] text-white">
                    📍 {where}
                  </div>
                  {data.country && (
                    <div className="text-[20px] text-white/55">
                      {data.city} · {data.country}
                    </div>
                  )}
                </div>
              )}
              {!where && data.country && (
                <div className="text-[22px] text-white/60">
                  📍 {data.city} · {data.country}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-10">
          <div className="flex flex-col gap-2">
            <div
              className="text-[14px] font-bold uppercase tracking-[0.28em]"
              style={{ color: '#ff8a8a' }}
            >
              {ctaLine(data)}
            </div>
            <div className="text-[30px] font-semibold tracking-tight text-white">
              albago.org
            </div>
          </div>

          {qrDataUrl && (
            <div
              className="shrink-0 rounded-2xl p-3.5"
              style={{ background: '#ffffff' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR code"
                width={150}
                height={150}
                style={{ display: 'block' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
