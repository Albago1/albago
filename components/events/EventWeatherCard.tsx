import { getEventForecast, isWetWeather, weatherLabel } from '@/lib/weather'
import {
  WEATHER_ICONS,
  isSnowCode,
  weatherIconKey,
} from '@/components/events/weatherIcon'

function rainLine(code: number, probability: number | null): string {
  const word = isSnowCode(code) ? 'snow' : 'rain'
  if (probability != null) {
    if (probability <= 5 && !isWetWeather(code)) return 'No rain expected'
    return `${probability}% chance of ${word}`
  }
  return isWetWeather(code) ? `${word[0].toUpperCase()}${word.slice(1)} expected` : 'No rain expected'
}

/**
 * Forecast row for the event action panel: temperature + rain outlook at the
 * event's start hour. Async server component — renders nothing (no reserved
 * space, no error state) when the event is outside the ~16-day forecast
 * window or the weather API is unreachable. Wrap in <Suspense fallback={null}>
 * so the page streams without waiting on Open-Meteo.
 */
export default async function EventWeatherCard(props: {
  lat: number
  lng: number
  date: string
  time: string | null
  timezone: string
}) {
  const forecast = await getEventForecast(props)
  if (!forecast) return null

  const Icon = WEATHER_ICONS[weatherIconKey(forecast.weatherCode)]
  const wet =
    isWetWeather(forecast.weatherCode) ||
    (forecast.precipitationProbability ?? 0) >= 50

  // Name the day so it's unmistakably the outlook for the event itself, not
  // today's weather.
  const dayLabel = new Date(`${props.date}T12:00:00`).toLocaleDateString(
    'en-GB',
    { weekday: 'short', day: 'numeric', month: 'short' },
  )

  return (
    <div className="mt-5 border-t border-white/[0.08] pt-5">
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex flex-col gap-1">
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            <Icon
              className={`h-3.5 w-3.5 ${wet ? 'text-sky-300' : 'text-amber-300'}`}
            />
            Weather on the day
          </span>
          <span className="text-[11px] font-medium text-white/45">
            {dayLabel}
          </span>
        </span>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-white">
            {Math.round(forecast.temperatureC)}°C
            <span className="ml-2 text-sm font-medium text-white/65">
              {weatherLabel(forecast.weatherCode)}
            </span>
          </p>
          <p className={`mt-0.5 text-xs ${wet ? 'text-sky-300/90' : 'text-white/50'}`}>
            {rainLine(forecast.weatherCode, forecast.precipitationProbability)}
          </p>
        </div>
      </div>
    </div>
  )
}
