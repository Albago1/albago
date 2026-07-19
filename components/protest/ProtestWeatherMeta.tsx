'use client'

import { useEventForecast } from '@/hooks/useEventForecast'
import { isWetWeather, weatherLabel } from '@/lib/weather'
import { isSnowCode, weatherIcon } from '@/components/events/weatherIcon'

/**
 * Compact forecast chip for protest/event list cards: "16°C · 38% rain".
 * Renders nothing until a forecast exists (no coords, too far out, or API
 * down all just mean no chip). Styled to match the card's Meta rows.
 */
export default function ProtestWeatherMeta(props: {
  lat: number | null
  lng: number | null
  date: string
  time: string | null
  timezone: string
}) {
  const forecast = useEventForecast(props)
  if (!forecast) return null

  const Icon = weatherIcon(forecast.weatherCode)
  const prob = forecast.precipitationProbability
  const wet = isWetWeather(forecast.weatherCode) || (prob ?? 0) >= 50
  const detail =
    prob != null && prob > 5
      ? `${prob}% ${isSnowCode(forecast.weatherCode) ? 'snow' : 'rain'}`
      : weatherLabel(forecast.weatherCode)

  return (
    <div className="flex items-center gap-1.5 text-white/65">
      <span className={wet ? 'text-sky-300' : 'text-flame-400'}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="truncate tabular-nums">
        {Math.round(forecast.temperatureC)}°C · {detail}
      </span>
    </div>
  )
}
