export function getTodayDateString() {
  return new Date().toISOString().split('T')[0]
}

export function getWeekendDateStrings() {
  const today = new Date()
  const dates: string[] = []

  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)

    const day = date.getDay()

    if (day === 5 || day === 6 || day === 0) {
      dates.push(date.toISOString().split('T')[0])
    }
  }

  return dates
}

export function isToday(dateString: string) {
  return dateString === getTodayDateString()
}

export function isThisWeekend(dateString: string) {
  return getWeekendDateStrings().includes(dateString)
}

// Compact, human label for "YYYY-MM-DD" dates. Returns "Tonight" / "Tomorrow"
// when close enough, otherwise "Mon, 23 Jun" — matches the style EventsClient
// already uses. T12:00:00 anchor avoids the UTC-shift off-by-one near midnight.
export function formatEventDateLabel(dateString: string): string {
  const eventDate = new Date(`${dateString}T12:00:00`)
  const today = new Date(`${getTodayDateString()}T12:00:00`)
  const diffInDays = Math.round(
    (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diffInDays === 0) return 'Tonight'
  if (diffInDays === 1) return 'Tomorrow'
  return eventDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Strip trailing seconds from a Postgres "HH:MM:SS" so 18:00:00 reads 18:00.
export function formatEventTimeLabel(time: string | null | undefined): string {
  if (!time) return ''
  return time.length >= 5 ? time.slice(0, 5) : time
}