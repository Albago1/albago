import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AlbaGo — Events, Movements & Nightlife',
    short_name: 'AlbaGo',
    description:
      'Discover events, venues, and civic gatherings across cities and continents.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#050505',
    theme_color: '#050505',
    categories: ['events', 'lifestyle', 'social', 'travel'],
    lang: 'sq',
    dir: 'ltr',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Events',
        short_name: 'Events',
        url: '/events',
        description: 'Browse live, upcoming and recurring events.',
      },
      {
        name: 'Protests',
        short_name: 'Protests',
        url: '/protests',
        description: 'Worldwide directory of peaceful civic gatherings.',
      },
      {
        name: 'Pankartat',
        short_name: 'Pankartat',
        url: '/pankartat',
        description: 'Protest placard library — copy, download, share.',
      },
    ],
  }
}
