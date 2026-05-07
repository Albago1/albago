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