import type { ShareEventData } from './types'

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
  return endTime ? `${time} – ${endTime}` : time
}

function cityHashtag(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
}

export function buildCaption(data: ShareEventData): string {
  const when = formatDateLong(data.date)
  const time = formatTime(data.time, data.endTime)
  const where = data.address || `${data.city}${data.country ? `, ${data.country}` : ''}`
  const tag = cityHashtag(data.city)

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
      '',
      `#AlbaGo #Protesta #DiasporaShqiptare${tag ? ` #${tag}` : ''}`,
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
    '',
    `#AlbaGo${tag ? ` #${tag}` : ''} #Evente`,
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
