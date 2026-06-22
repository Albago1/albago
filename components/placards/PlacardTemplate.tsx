import {
  AlbaGoWordmark,
  FlamingoHalo,
  FlamingoMotif,
  GridBackdrop,
} from '@/components/share/templates/shared'
import { PLACARD_CATEGORY_LABELS, PLACARD_LANGUAGE_LABELS } from '@/lib/placards'
import type { Placard } from '@/lib/placards'

type Props = {
  placard: Placard
  innerRef?: React.RefObject<HTMLDivElement | null>
}

function sloganSize(len: number, scale: 'square' | 'story'): number {
  if (scale === 'story') {
    if (len <= 18) return 220
    if (len <= 28) return 180
    if (len <= 40) return 140
    return 108
  }
  if (len <= 18) return 180
  if (len <= 28) return 140
  if (len <= 40) return 108
  return 84
}

function metaLine(placard: Placard): string {
  const lang = PLACARD_LANGUAGE_LABELS[placard.language]
  const primaryCat = placard.categories.find((c) => c !== 'short' && c !== 'powerful')
  const catLabel = primaryCat ? PLACARD_CATEGORY_LABELS[primaryCat] : null
  return [lang.flag + ' ' + lang.label, catLabel].filter(Boolean).join(' · ')
}

export function PlacardSquare({ placard, innerRef }: Props) {
  const size = sloganSize(placard.slogan.length, 'square')
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
        <FlamingoHalo size={760} />
        <div style={{ position: 'relative' }}>
          <FlamingoMotif width={480} opacity={0.38} />
        </div>
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between px-20 py-20">
        <div className="flex items-center justify-between">
          <AlbaGoWordmark size="md" />
          <div
            className="rounded-full px-4 py-1.5 text-xs font-bold tracking-[0.22em]"
            style={{
              background: 'rgba(238,28,37,0.18)',
              color: '#ff8a8a',
              border: '1px solid rgba(238,28,37,0.45)',
            }}
          >
            PANKARTË · PLACARD
          </div>
        </div>

        <div className="flex flex-col gap-10">
          <div
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: size,
              lineHeight: 0.95,
              letterSpacing: '-0.035em',
              color: '#ffffff',
              textShadow: '0 6px 36px rgba(5,5,5,0.85)',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {placard.slogan}
          </div>

          <div className="flex items-center gap-4">
            <div
              className="h-[2px] w-16"
              style={{ background: '#ee1c25', boxShadow: '0 0 14px rgba(238,28,37,0.7)' }}
            />
            <div
              className="text-[22px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: 'rgba(255,255,255,0.78)' }}
            >
              {metaLine(placard)}
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <div
              className="text-[14px] font-bold uppercase tracking-[0.28em]"
              style={{ color: '#ff8a8a' }}
            >
              Pankartat e Revolucionit
            </div>
            <div className="text-[26px] font-semibold tracking-tight text-white">
              albago.org/pankartat
            </div>
          </div>
          {placard.city && (
            <div
              className="rounded-full px-4 py-1.5 text-[13px] font-semibold tracking-wide"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {placard.city}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function PlacardStory({ placard, innerRef }: Props) {
  const size = sloganSize(placard.slogan.length, 'story')
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

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FlamingoHalo size={1000} />
        <div style={{ position: 'relative' }}>
          <FlamingoMotif width={680} opacity={0.42} />
        </div>
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between px-20 py-28">
        <div className="flex items-center justify-between">
          <AlbaGoWordmark size="lg" />
          <div
            className="rounded-full px-5 py-2 text-sm font-bold tracking-[0.22em]"
            style={{
              background: 'rgba(238,28,37,0.18)',
              color: '#ff8a8a',
              border: '1px solid rgba(238,28,37,0.45)',
            }}
          >
            PANKARTË · PLACARD
          </div>
        </div>

        <div className="flex flex-col gap-14">
          <div
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: size,
              lineHeight: 0.95,
              letterSpacing: '-0.035em',
              color: '#ffffff',
              textShadow: '0 8px 44px rgba(5,5,5,0.85)',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {placard.slogan}
          </div>

          <div className="flex items-center gap-5">
            <div
              className="h-[3px] w-24"
              style={{ background: '#ee1c25', boxShadow: '0 0 18px rgba(238,28,37,0.7)' }}
            />
            <div
              className="text-[28px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: 'rgba(255,255,255,0.78)' }}
            >
              {metaLine(placard)}
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-3">
            <div
              className="text-[18px] font-bold uppercase tracking-[0.28em]"
              style={{ color: '#ff8a8a' }}
            >
              Pankartat e Revolucionit
            </div>
            <div className="text-[40px] font-semibold tracking-tight text-white">
              albago.org/pankartat
            </div>
          </div>
          {placard.city && (
            <div
              className="rounded-full px-5 py-2 text-[16px] font-semibold tracking-wide"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.78)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {placard.city}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
