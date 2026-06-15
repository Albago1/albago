import type { Metadata } from 'next'
import EdiRamaBerlinClient from './EdiRamaBerlinClient'

const PAGE_URL = 'https://albago.org/protests/edi-rama-berlin'
const PDF_URL = '/documents/ost-ausschuss-edi-rama-berlin-2026.pdf'

export const metadata: Metadata = {
  title:
    'Edi Rama in Berlin · 16 June 2026 — Peaceful Protest Information · AlbaGo',
  description:
    'Albanian Prime Minister Edi Rama is expected as keynote speaker at the Ost-Ausschuss annual conference in Berlin on 16 June 2026. Confirmed date, address and official programme for a peaceful Albanian Revolution / Flamingo Revolution gathering.',
  alternates: {
    canonical: PAGE_URL,
  },
  keywords: [
    'Edi Rama Berlin',
    'Edi Rama protest Berlin',
    'Edi Rama 16 June 2026',
    'Albanian protest Berlin',
    'Albanian Revolution Berlin',
    'Flamingo Revolution',
    'Revolucioni Shqiptar',
    'Revolucioni Flamingo',
    'Albaner Demonstration Berlin',
    'Ost-Ausschuss Berlin',
    'Theater Aufbau Kreuzberg',
    'Club Prince Charles Berlin',
    'Albanians in Germany',
    'Albanians in Berlin',
    'AlbaGo',
  ],
  openGraph: {
    type: 'article',
    url: PAGE_URL,
    siteName: 'AlbaGo',
    title:
      'Edi Rama in Berlin — peaceful protest information · 16 June 2026',
    description:
      'Confirmed date, address and official programme. A peaceful Albanian Revolution / Flamingo Revolution gathering point.',
    locale: 'en_GB',
    images: [
      {
        url: 'https://albago.org/AlbaGo_AG_Logo.svg',
        width: 1200,
        height: 630,
        alt: 'AlbaGo — Edi Rama in Berlin, 16 June 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Edi Rama in Berlin — peaceful protest information',
    description:
      '16 June 2026 · Theater Aufbau Kreuzberg, Berlin. Confirmed programme and download link.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const eventJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: 'Edi Rama in Berlin — peaceful protest information',
  description:
    'Peaceful Albanian Revolution / Flamingo Revolution civic gathering coinciding with the appearance of Albanian Prime Minister Edi Rama at the annual conference of the Ost-Ausschuss der Deutschen Wirtschaft on 16 June 2026 in Berlin.',
  startDate: '2026-06-16T17:30:00+02:00',
  endDate: '2026-06-16T22:00:00+02:00',
  eventStatus: 'https://schema.org/EventScheduled',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  location: {
    '@type': 'Place',
    name: 'Theater Aufbau Kreuzberg (TAK) & Club Prince Charles',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Prinzenstraße 85',
      addressLocality: 'Berlin',
      postalCode: '10969',
      addressCountry: 'DE',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 52.501,
      longitude: 13.408,
    },
  },
  organizer: {
    '@type': 'Organization',
    name: 'AlbaGo — Albanian Revolution',
    url: 'https://albago.org',
  },
  inLanguage: ['en', 'de', 'sq'],
  isAccessibleForFree: true,
  url: PAGE_URL,
  image: 'https://albago.org/AlbaGo_AG_Logo.svg',
  about: 'Peaceful civic gathering of the Albanian diaspora.',
}

export default function EdiRamaBerlinPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <EdiRamaBerlinClient pageUrl={PAGE_URL} pdfUrl={PDF_URL} />
    </>
  )
}
