import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo/jsonLd'
import { HYSA_COPY } from './copy'
import { FIGHTERS, HYSA_EVENT, HYSA_LANGS, hysaPath, OFFICIAL_SHOP_URL, type HysaLang } from './event'

// SEO for /hysa (phase 44): per-language canonical + hreflang, Open Graph /
// Twitter cards, and SportsEvent JSON-LD. AlbaGo is never presented as the
// organiser or seller — the offer points at the official ticket channel.

const OG_LOCALE: Record<HysaLang, string> = { sq: 'sq_AL', de: 'de_DE', en: 'en_GB' }

export const ogImageUrl = (lang: HysaLang) => `${SITE_URL}/api/og/hysa?lang=${lang}`

export function hysaMetadata(lang: HysaLang): Metadata {
  const c = HYSA_COPY[lang]
  const url = `${SITE_URL}${hysaPath(lang)}`
  return {
    title: { absolute: c.meta.title },
    description: c.meta.description,
    alternates: {
      canonical: url,
      languages: {
        sq: `${SITE_URL}${hysaPath('sq')}`,
        de: `${SITE_URL}${hysaPath('de')}`,
        en: `${SITE_URL}${hysaPath('en')}`,
        'x-default': `${SITE_URL}${hysaPath('sq')}`,
      },
    },
    openGraph: {
      type: 'website',
      url,
      siteName: 'AlbaGo',
      title: c.meta.title,
      description: c.meta.description,
      locale: OG_LOCALE[lang],
      alternateLocale: HYSA_LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
      images: [{ url: ogImageUrl(lang), width: 1200, height: 630, alt: c.meta.ogAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: c.meta.title,
      description: c.meta.description,
      images: [ogImageUrl(lang)],
    },
  }
}

export function hysaEventSchema(lang: HysaLang) {
  const c = HYSA_COPY[lang]
  const { venue } = HYSA_EVENT
  const person = (name: string, nationality: string) => ({ '@type': 'Person', name, nationality })
  const fighters = [
    person(FIGHTERS.hysa.name, 'Albania'),
    person(FIGHTERS.kabayel.name, 'Germany'),
  ]
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${FIGHTERS.hysa.name} vs ${FIGHTERS.kabayel.name} — ${HYSA_EVENT.title}`,
    description: c.meta.description,
    url: `${SITE_URL}${hysaPath(lang)}`,
    inLanguage: lang,
    image: [ogImageUrl(lang)],
    startDate: HYSA_EVENT.date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    sport: 'Boxing',
    location: {
      '@type': 'Place',
      name: 'Merkur Spiel-Arena',
      address: {
        '@type': 'PostalAddress',
        streetAddress: venue.street,
        postalCode: venue.postalCode,
        addressLocality: venue.city,
        addressCountry: venue.country,
      },
      geo: { '@type': 'GeoCoordinates', latitude: venue.lat, longitude: venue.lng },
    },
    competitor: fighters,
    performer: fighters,
    organizer: { '@type': 'Organization', name: 'Queensberry Promotions', url: 'https://queensberry.co.uk' },
    // The official Nelson Hysa ticket channel — not an AlbaGo offer.
    offers: { '@type': 'Offer', url: OFFICIAL_SHOP_URL, priceCurrency: 'EUR' },
  }
}
