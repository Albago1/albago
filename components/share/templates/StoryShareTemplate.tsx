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
  fitSize,
  formatDateForCard,
  formatTimeRangeForCard,
  shortAddress,
} from './shared'

type Props = {
  data: ShareEventData
  qrDataUrl: string | null
  innerRef?: React.RefObject<HTMLDivElement | null>
  /** AI-generated artwork (data URL) painted behind the typography. */
  backdropUrl?: string | null
}

export default function StoryShareTemplate({ data, qrDataUrl, innerRef, backdropUrl }: Props) {
  const date = formatDateForCard(data.date)
  const time = formatTimeRangeForCard(data.time, data.endTime)
  const isCivic = data.isCivic
  const where = shortAddress(data.address)

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
      {backdropUrl ? (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backdropUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Scrim so the typography and info card stay readable over any art. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(5,5,5,0.62) 0%, rgba(5,5,5,0.26) 38%, rgba(5,5,5,0.42) 62%, rgba(5,5,5,0.88) 100%)',
            }}
          />
        </div>
      ) : (
        <>
          <GridBackdrop />

          {/* Flamingo motif — the protest campaign's mark, civic events only.
              Normal events get the pure brand backdrop (grid + flame glow). */}
          {isCivic && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '38%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FlamingoHalo size={900} />
              <div style={{ position: 'relative' }}>
                <FlamingoMotif width={620} opacity={0.5} />
              </div>
            </div>
          )}
        </>
      )}

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

        <div className="mt-24 flex flex-col gap-8">
          <DateHero iso={data.date} isCivic={isCivic} scale="lg" />

          <h1
            className="leading-[0.95]"
            style={{
              fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif",
              fontSize: fitSize(data.city, 168, 104, 11),
              letterSpacing: '-0.04em',
              color: '#ffffff',
              textShadow: '0 6px 40px rgba(5,5,5,0.85)',
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
              fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif",
              fontSize: fitSize(data.title, 64, 42, 52),
              letterSpacing: '-0.02em',
              color: 'rgba(255,255,255,0.92)',
              textShadow: '0 4px 30px rgba(5,5,5,0.85)',
            }}
          >
            {data.title}
          </div>
        </div>

        <div className="mt-auto">
          <div
            className="grid gap-6 rounded-3xl p-10"
            style={{
              background: 'rgba(5,5,5,0.72)',
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-baseline gap-6">
              <div
                className="w-[260px] shrink-0 text-[16px] font-bold uppercase tracking-[0.24em]"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                {bilingualLabel('Data', 'Date', isCivic)}
              </div>
              <div className="text-[34px] font-semibold text-white">
                {date.weekday}, {date.day} {date.month}
              </div>
            </div>

            {time && (
              <div className="flex items-baseline gap-6">
                <div
                  className="w-[260px] shrink-0 text-[16px] font-bold uppercase tracking-[0.24em]"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  {bilingualLabel('Ora', 'Time', isCivic)}
                </div>
                <div className="text-[34px] font-semibold text-white tabular-nums">{time}</div>
              </div>
            )}

            {where && (
              <div className="flex items-baseline gap-6">
                <div
                  className="w-[260px] shrink-0 text-[16px] font-bold uppercase tracking-[0.24em]"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  {bilingualLabel('Pika e takimit', 'Meeting point', isCivic)}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-[34px] font-semibold leading-[1.15] text-white">
                    {where}
                  </div>
                  <div className="text-[22px] text-white/60">
                    {data.city}
                    {data.country ? ` · ${data.country}` : ''}
                  </div>
                </div>
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
                  {isCivic
                    ? `Organizuar nga · Organized by · ${data.organizerName}`
                    : `Hosted by · ${data.organizerName}`}
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
