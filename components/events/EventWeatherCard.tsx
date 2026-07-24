import {
  getEventForecast,
  getEventForecastRange,
  type DayForecast,
} from '@/lib/weather'
import EventWeatherPanel from '@/components/events/EventWeatherPanel'

/**
 * Forecast for the event's action panel. Single-day events show one day;
 * continuous multi-day events (festivals) show a forecast per day. Async server
 * component — renders nothing (no reserved space, no error state) when the
 * event is outside the ~16-day forecast window or the weather API is
 * unreachable. Wrap in <Suspense fallback={null}> so the page streams without
 * waiting on Open-Meteo.
 */
export default async function EventWeatherCard(props: {
  lat: number
  lng: number
  date: string
  /** Last day of a continuous multi-day event; when set, a per-day forecast. */
  endDate?: string | null
  time: string | null
  timezone: string
}) {
  let days: DayForecast[]

  if (props.endDate && props.endDate > props.date) {
    days = await getEventForecastRange({
      lat: props.lat,
      lng: props.lng,
      startDate: props.date,
      endDate: props.endDate,
      time: props.time,
      timezone: props.timezone,
    })
  } else {
    const single = await getEventForecast(props)
    days = single ? [{ date: props.date, ...single }] : []
  }

  if (days.length === 0) return null

  return <EventWeatherPanel days={days} />
}
