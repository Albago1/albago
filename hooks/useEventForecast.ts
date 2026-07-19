'use client'

import { useEffect, useState } from 'react'
import { getEventForecast, type EventForecast } from '@/lib/weather'

// Module-level promise cache so a grid of cards fires one Open-Meteo request
// per (place, date, hour) instead of one per card render.
const cache = new Map<string, Promise<EventForecast | null>>()

/**
 * Browser-side forecast for list cards (Open-Meteo allows CORS). Returns null
 * until loaded — and stays null when the event has no coordinates, is outside
 * the ~16-day forecast window, or the API is unreachable, so callers can
 * simply not render anything.
 */
export function useEventForecast(params: {
  lat: number | null
  lng: number | null
  date: string
  time: string | null
  timezone: string
}): EventForecast | null {
  const { lat, lng, date, time, timezone } = params
  const [forecast, setForecast] = useState<EventForecast | null>(null)

  useEffect(() => {
    if (lat == null || lng == null) return
    const key = `${lat.toFixed(4)},${lng.toFixed(4)},${date},${time ?? ''}`
    let promise = cache.get(key)
    if (!promise) {
      promise = getEventForecast({ lat, lng, date, time, timezone })
      cache.set(key, promise)
    }
    let cancelled = false
    promise.then((result) => {
      if (!cancelled) setForecast(result)
    })
    return () => {
      cancelled = true
    }
  }, [lat, lng, date, time, timezone])

  return forecast
}
