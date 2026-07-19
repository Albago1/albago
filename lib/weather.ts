// Event-day forecast via Open-Meteo (https://open-meteo.com) — free, no API
// key. Forecasts exist ~16 days out; outside that window we return null and
// the widget simply doesn't render. Never store forecasts in the DB — they
// are volatile by nature and fetched at render time, cached briefly.

export type EventForecast = {
  /** Air temperature at the event's start hour, °C. */
  temperatureC: number
  /** 0–100, null when the API has no probability for that hour. */
  precipitationProbability: number | null
  /** WMO weather interpretation code. */
  weatherCode: number
}

// Open-Meteo guarantees forecast data up to 16 days ahead; day 0 is today.
const MAX_FORECAST_DAYS = 15

type OpenMeteoHourly = {
  hourly?: {
    time?: string[]
    temperature_2m?: (number | null)[]
    precipitation_probability?: (number | null)[]
    weather_code?: (number | null)[]
  }
}

/** Today's YYYY-MM-DD in the event's timezone, so the forecast window is
 *  judged against the event's local calendar, not the server's. */
function todayIsoIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/** Nearest whole hour to an HH:MM[:SS] start time, clamped to the same day. */
function roundedHour(time: string | null): number {
  if (!time || time.length < 5) return 20 // evening default fits most events
  const h = Number(time.slice(0, 2))
  const m = Number(time.slice(3, 5))
  if (!Number.isFinite(h)) return 20
  return Math.min(23, m >= 30 ? h + 1 : h)
}

export async function getEventForecast(params: {
  lat: number
  lng: number
  /** Event date, YYYY-MM-DD (already resolved to the next occurrence for
   *  recurring events by the caller). */
  date: string
  time: string | null
  timezone: string
}): Promise<EventForecast | null> {
  const { lat, lng, date, time, timezone } = params

  const dayDiff = Math.round(
    (Date.parse(`${date}T00:00:00Z`) -
      Date.parse(`${todayIsoIn(timezone)}T00:00:00Z`)) /
      86_400_000,
  )
  if (!Number.isFinite(dayDiff) || dayDiff < 0 || dayDiff > MAX_FORECAST_DAYS) {
    return null
  }

  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    '&hourly=temperature_2m,precipitation_probability,weather_code' +
    `&start_date=${date}&end_date=${date}` +
    `&timezone=${encodeURIComponent(timezone)}`

  try {
    const res = await fetch(url, {
      // Forecasts drift slowly; 2h server cache keeps us miles under
      // Open-Meteo's free tier while staying fresh enough for "will it rain".
      next: { revalidate: 7200 },
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return null
    const data = (await res.json()) as OpenMeteoHourly
    const times = data.hourly?.time ?? []
    const hour = roundedHour(time)
    const wanted = `${date}T${String(hour).padStart(2, '0')}:00`
    const idx = times.indexOf(wanted)
    if (idx === -1) return null

    const temperature = data.hourly?.temperature_2m?.[idx]
    const code = data.hourly?.weather_code?.[idx]
    if (temperature == null || code == null) return null

    return {
      temperatureC: temperature,
      precipitationProbability:
        data.hourly?.precipitation_probability?.[idx] ?? null,
      weatherCode: code,
    }
  } catch {
    // Weather is a nice-to-have — the page never fails because of it.
    return null
  }
}

/** Human label for a WMO weather code (groups, not all 100 codes). */
export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear sky'
  if (code === 1) return 'Mostly clear'
  if (code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code === 45 || code === 48) return 'Foggy'
  if (code >= 51 && code <= 57) return 'Light drizzle'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow'
  if (code >= 95) return 'Thunderstorm'
  return 'Mixed conditions'
}

/** True when the code itself means precipitation, regardless of probability. */
export function isWetWeather(code: number): boolean {
  return code >= 51
}
