'use client'

import { useState } from 'react'
import { ChevronDown, CloudSun } from 'lucide-react'
import { isWetWeather, weatherLabel } from '@/lib/weather'
import {
  WEATHER_ICONS,
  isSnowCode,
  weatherIconKey,
} from '@/components/events/weatherIcon'

type Day = {
  date: string
  temperatureC: number
  precipitationProbability: number | null
  weatherCode: number
}

function rainLine(code: number, probability: number | null): string {
  const word = isSnowCode(code) ? 'snow' : 'rain'
  if (probability != null) {
    if (probability <= 5 && !isWetWeather(code)) return 'No rain expected'
    return `${probability}% chance of ${word}`
  }
  return isWetWeather(code)
    ? `${word[0].toUpperCase()}${word.slice(1)} expected`
    : 'No rain expected'
}

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function DayRow({ day }: { day: Day }) {
  const Icon = WEATHER_ICONS[weatherIconKey(day.weatherCode)]
  const wet =
    isWetWeather(day.weatherCode) || (day.precipitationProbability ?? 0) >= 50
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
          <Icon className={`h-6 w-6 ${wet ? 'text-sky-300' : 'text-amber-300'}`} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-white">
            {dayLabel(day.date)}
          </p>
          <p
            className={`text-xs ${wet ? 'text-sky-300/90' : 'text-white/50'}`}
          >
            {rainLine(day.weatherCode, day.precipitationProbability)}
          </p>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-2xl font-bold tabular-nums text-white">
          {Math.round(day.temperatureC)}°
        </p>
        <p className="text-[11px] font-medium text-white/55">
          {weatherLabel(day.weatherCode)}
        </p>
      </div>
    </div>
  )
}

/**
 * Boxed weather sub-card for the event info panel. Single-day events show one
 * row; multi-day events show the first two days with a "+N more days" reveal
 * for the rest — each row names its own day, so it's clear which forecast is
 * which.
 */
export default function EventWeatherPanel({ days }: { days: Day[] }) {
  const [open, setOpen] = useState(false)
  if (days.length === 0) return null

  const multi = days.length > 1
  const visible = days.slice(0, 2)
  const rest = days.slice(2)

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:mt-7 lg:p-5">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 lg:text-xs">
        <CloudSun className="h-4 w-4 text-amber-300" />
        {multi ? 'Weather during the event' : 'Weather on the day'}
      </div>

      <div className="divide-y divide-white/[0.06]">
        {visible.map((d) => (
          <DayRow key={d.date} day={d} />
        ))}
        {open && rest.map((d) => <DayRow key={d.date} day={d} />)}
      </div>

      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
        >
          {open ? 'Show less' : `+${rest.length} more day${rest.length > 1 ? 's' : ''}`}
          <ChevronDown
            className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  )
}
