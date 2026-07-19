import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { getEventForecast, isWetWeather, weatherLabel } from '@/lib/weather'

function weatherIcon(code: number): LucideIcon {
  if (code === 0) return Sun
  if (code === 1 || code === 2) return CloudSun
  if (code === 3) return Cloud
  if (code === 45 || code === 48) return CloudFog
  if (code >= 51 && code <= 57) return CloudDrizzle
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow
  if (code >= 95) return CloudLightning
  return Cloud
}

function rainLine(code: number, probability: number | null): string {
  const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86
  const word = isSnow ? 'snow' : 'rain'
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

  const Icon = weatherIcon(forecast.weatherCode)
  const wet =
    isWetWeather(forecast.weatherCode) ||
    (forecast.precipitationProbability ?? 0) >= 50

  return (
    <div className="mt-5 border-t border-white/[0.08] pt-5">
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          <Icon
            className={`h-3.5 w-3.5 ${wet ? 'text-sky-300' : 'text-amber-300'}`}
          />
          Forecast
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
