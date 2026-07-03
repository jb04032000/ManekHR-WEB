/* Zari360 service worker - the installable-app (PWA) runtime.
 *
 * Scope: served from /sw.js so its scope is the whole site (/). Registered by
 * components/pwa/ServiceWorkerRegistrar.tsx in production only. The auth proxy
 * (proxy.ts) excludes /sw.js from its matcher so this file is reachable
 * logged-out.
 *
 * Caching strategy (deliberately conservative):
 *   - Navigations (HTML): NETWORK-FIRST, never cached. On network failure we
 *     serve the precached /offline page. Page HTML is NOT cached because most
 *     pages carry per-user data (salary, attendance, inbox) behind an
 *     httpOnly-cookie session; caching it risks showing one user stale data or
 *     leaking it to the next. "Instant load" comes from cached static assets
 *     below, not from cached HTML.
 *   - /_next/static/* and same-origin static files (js, css, fonts, icons):
 *     CACHE-FIRST. They are content-hashed / immutable and carry no personal
 *     data, so they are safe to serve from cache.
 *   - Everything else (same-origin /api, /_next/image avatars, the /monitoring
 *     Sentry tunnel, and ALL cross-origin requests incl. the backend API,
 *     socket.io and analytics): NETWORK-ONLY. The worker does not touch them.
 *
 * Bump CACHE_VERSION to invalidate old caches on the next activate.
 */

const CACHE_VERSION = 'v1';
const PRECACHE = `z360-precache-${CACHE_VERSION}`;
const RUNTIME = `z360-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

// The offline fallback must be available with zero network. The icons let the
// offline page render branded even on a cold cache.
const PRECACHE_URLS = [OFFLINE_URL, '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // addAll is all-or-nothing; add individually so one 404 can't fail install.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions so a deploy can't keep serving stale assets.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('z360-') && k !== PRECACHE && k !== RUNTIME)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Let the page tell a waiting worker to take over immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const STATIC_ASSET = /\.(?:js|css|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|avif|ico)$/i;

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') || STATIC_ASSET.test(url.pathname);
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Only store complete, same-origin OK responses (skip opaque / partial).
  if (response && response.ok && response.type === 'basic') {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(PRECACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ||
      new Response('You are offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Never touch mutations: server actions, the Sentry POST tunnel, uploads, etc.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Cross-origin (backend API, socket.io, analytics, fonts CDN) is left to the
  // network so we never interfere with auth, realtime, or third parties.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Same-origin non-static GET (/api, /_next/image, /manifest.webmanifest,
  // /monitoring): left to the network so we never serve stale per-user data.
});
