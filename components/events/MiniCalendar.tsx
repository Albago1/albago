'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { languageLocales } from '@/lib/i18n/config'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toDateString(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type MiniCalendarProps = {
  /** YYYY-MM-DD or '' */
  from: string
  /** YYYY-MM-DD or '' */
  to: string
  onChange: (from: string, to: string) => void
}

/**
 * Airbnb-style range calendar: first click sets the start, second click sets
 * the end (clicking before the start restarts the range). While picking the
 * end, hovering previews the tentative range. Past dates are disabled.
 */
export default function MiniCalendar({ from, to, onChange }: MiniCalendarProps) {
  const { t, language } = useLanguage()
  const locale = languageLocales[language]

  // Monday-first two-letter weekday headers in the active language.
  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    // 2024-01-01 is a Monday.
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2024, 0, 1 + i)).replace('.', '').slice(0, 2),
    )
  }, [locale])

  const todayStr = useMemo(() => toDateString(new Date()), [])
  const initial = from ? new Date(`${from}T00:00:00`) : new Date()
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [hovered, setHovered] = useState<string | null>(null)

  const cells = useMemo(() => {
    // Monday-first weekday offset for the 1st of the month.
    const offset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const list: (string | null)[] = Array.from({ length: offset }, () => null)
    for (let day = 1; day <= daysInMonth; day++) {
      list.push(toDateString(new Date(viewYear, viewMonth, day)))
    }
    return list
  }, [viewYear, viewMonth])

  const selectingEnd = from !== '' && to === ''
  // Range shown on screen: committed end, or the hovered day while picking.
  const previewEnd = to || (selectingEnd && hovered && hovered > from ? hovered : '')

  const viewYm = `${viewYear}-${pad(viewMonth + 1)}`
  const canGoPrev = viewYm > todayStr.slice(0, 7)

  const goToMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const pick = (day: string) => {
    if (selectingEnd) {
      if (day < from) {
        onChange(day, '')
        return
      }
      onChange(from, day)
      return
    }
    onChange(day, '')
  }

  return (
    <div className="select-none">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          disabled={!canGoPrev}
          aria-label={t('cal_prev_month')}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="text-sm font-semibold text-white">
          {new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, { month: 'long' })}{' '}
          {viewYear}
        </p>

        <button
          type="button"
          onClick={() => goToMonth(1)}
          aria-label={t('cal_next_month')}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.08] hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 text-center">
        {weekdayLabels.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="py-1 text-[10px] font-semibold uppercase tracking-wide text-white/35"
          >
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => setHovered(null)}>
        {cells.map((day, i) => {
          if (!day) return <span key={`pad-${i}`} />

          const disabled = day < todayStr
          const isStart = day === from
          const isCommittedEnd = to !== '' && day === to
          const isHoverEnd = selectingEnd && previewEnd !== '' && day === previewEnd
          const inRange =
            from !== '' && previewEnd !== '' && day > from && day < previewEnd
          const isToday = day === todayStr

          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => pick(day)}
              onMouseEnter={() => setHovered(day)}
              aria-pressed={isStart || isCommittedEnd}
              className={[
                'relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition',
                disabled
                  ? 'cursor-not-allowed text-white/20'
                  : isStart || isCommittedEnd
                    ? 'bg-flame-500 font-semibold text-white shadow-glow-flame'
                    : isHoverEnd
                      ? 'bg-flame-500/40 text-white'
                      : inRange
                        ? 'bg-flame-500/15 text-flame-100'
                        : 'text-white/80 hover:bg-white/[0.10] hover:text-white',
                isToday && !isStart && !isCommittedEnd ? 'ring-1 ring-white/25' : '',
              ].join(' ')}
            >
              {Number(day.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
