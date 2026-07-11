/*
 * AlbaGo service worker — hand-rolled on purpose (master plan APP-1: keep it
 * minimal and auditable). Strategies:
 *
 *   navigations      network-first → cache → /offline.html
 *   /_next/static    cache-first (content-hashed, immutable)
 *   icons/manifest   cache-first
 *   images/posters   stale-while-revalidate, capped
 *   api/auth/admin   never intercepted
 *
 * Bump VERSION on any strategy change — activate() drops old caches.
 */

const VERSION = 'v1';
const SHELL_CACHE = `albago-shell-${VERSION}`;
const PAGES_CACHE = `albago-pages-${VERSION}`;
const STATIC_CACHE = `albago-static-${VERSION}`;
const MEDIA_CACHE = `albago-media-${VERSION}`;

const OFFLINE_URL = '/offline.html';

const PRECACHE = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Navigations under these prefixes are never cached (per-user or sensitive).
// TIX exception to come: the My Tickets route gets an explicit offline cache
// (venue basements have no signal) — add it to TICKET_ROUTES when TIX-2 ships.
const UNCACHED_NAV_PREFIXES = [
  '/dashboard',
  '/admin',
  '/onboarding',
  '/sign-in',
  '/sign-up',
  '/auth',
  '/verification',
];

const TICKET_ROUTES = []; // e.g. '/dashboard/tickets' once TIX-2 ships

const MEDIA_MAX_ENTRIES = 80;
const PAGES_MAX_ENTRIES = 40;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, PAGES_CACHE, STATIC_CACHE, MEDIA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('albago-') && !keep.has(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)),
  );
}

function isCacheableNavigation(url) {
  if (TICKET_ROUTES.some((p) => url.pathname.startsWith(p))) return true;
  return !UNCACHED_NAV_PREFIXES.some((p) => url.pathname.startsWith(p));
}

async function networkFirstNavigation(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok && isCacheableNavigation(url)) {
      const cache = await caches.open(PAGES_CACHE);
      cache.put(request, response.clone());
      trimCache(PAGES_CACHE, PAGES_MAX_ENTRIES);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
        trimCache(cacheName, maxEntries);
      }
      return response;
    })
    .catch(() => undefined);
  if (cached) return cached;
  const fresh = await refresh;
  return fresh || Response.error();
}

function isMediaRequest(url) {
  if (url.pathname.startsWith('/_next/image')) return true;
  // Supabase public storage: event photos, AI posters, placards.
  if (
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.includes('/storage/v1/object/public/')
  ) {
    return true;
  }
  return /\.(png|jpg|jpeg|webp|avif|gif|svg)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Never intercept APIs, auth, or anything carrying Range headers.
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
  } else if (!isMediaRequest(url)) {
    // Cross-origin: only media is handled (Supabase auth/REST passes through).
    return;
  }
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request, url));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    }
    if (
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/icon.svg' ||
      url.pathname === '/manifest.webmanifest'
    ) {
      event.respondWith(cacheFirst(request, SHELL_CACHE));
      return;
    }
  }

  if (isMediaRequest(url)) {
    event.respondWith(
      staleWhileRevalidate(request, MEDIA_CACHE, MEDIA_MAX_ENTRIES),
    );
  }
});

/* ---- Web push (APP-1d) ----------------------------------------------
 * Payload contract (JSON): { title, body, url?, tag? }
 * Sent by lib/push/send.ts — keep both sides in sync.
 */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'AlbaGo';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || undefined,
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if (new URL(client.url).origin === self.location.origin) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
