import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'AlbaGo — Events, Movements & Nightlife',
    short_name: 'AlbaGo',
    description:
      'Discover events, venues, and civic gatherings across cities and continents.',
    // source=pwa lets analytics separate installed-app sessions from browser
    // sessions — the M19 native-gate metrics depend on this split.
    start_url: '/?source=pwa',
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
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Search',
        short_name: 'Search',
        url: '/events?focus=search',
        description: 'Search events, venues and cities.',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Map',
        short_name: 'Map',
        url: '/map',
        description: 'Explore everything happening on the live map.',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Events',
        short_name: 'Events',
        url: '/events',
        description: 'Browse live, upcoming and recurring events.',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Protests',
        short_name: 'Protests',
        url: '/protests',
        description: 'Worldwide directory of peaceful civic gatherings.',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  }
}
