import type { ShareEventData } from './types'
import { formatEventTimeLabel } from '@/lib/dateFilters'

function formatDateLong(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(time: string | null, endTime: string | null): string {
  if (!time) return ''
  const start = formatEventTimeLabel(time)
  const end = formatEventTimeLabel(endTime)
  return end ? `${start} – ${end}` : start
}

export function buildCaption(data: ShareEventData): string {
  const when = formatDateLong(data.date)
  const time = formatTime(data.time, data.endTime)
  const where = data.address || `${data.city}${data.country ? `, ${data.country}` : ''}`

  if (data.isCivic) {
    return [
      `🇦🇱 Protesta e radhës në ${data.city}${data.country ? `, ${data.country}` : ''}`,
      '',
      `📍 ${where}`,
      `📅 ${when}`,
      time ? `🕒 ${time}` : null,
      '',
      'Detajet i gjeni në AlbaGo:',
      data.eventUrl,
    ]
      .filter((line) => line !== null)
      .join('\n')
  }

  return [
    `📍 ${data.title}`,
    '',
    `📌 ${data.city}${data.country ? `, ${data.country}` : ''}`,
    `📅 ${when}`,
    time ? `🕒 ${time}` : null,
    `📍 ${where}`,
    '',
    'Zbulo më shumë në AlbaGo:',
    data.eventUrl,
  ]
    .filter((line) => line !== null)
    .join('\n')
}

export function buildShortText(data: ShareEventData): string {
  const when = formatDateLong(data.date)
  const time = formatTime(data.time, data.endTime)
  const piece = time ? `${when} · ${time}` : when
  return `${data.title} — ${piece} — ${data.city}`
}
