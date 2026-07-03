import type { MetadataRoute } from 'next';

// Web app manifest -> drives the installable-app (PWA) experience: home-screen
// icon, standalone full-screen launch, splash colors. Next's App Router serves
// this at /manifest.webmanifest (linked from app/layout.tsx metadata, and
// bypassed by the auth proxy matcher in proxy.ts so it is reachable logged-out).
// The service worker (public/sw.js) is the other half of "installable".
// Watch: keep theme_color in sync with viewport.themeColor in app/layout.tsx and
// background_color with the page background used by app/offline/page.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Stable install identity so an updated start_url never spawns a duplicate
    // installed app.
    id: '/',
    name: 'ManekHR',
    short_name: 'ManekHR',
    description: 'ManekHR - staff and salary, made simple',
    // '/launch' (not '/'): production '/' is CDN-cached without cookies in the
    // cache key, so the proxy's logged-in redirect never ran and PWA launches
    // showed the marketing page. '/launch' is handled dynamically in proxy.ts
    // (no-store redirects): signed-in -> last product, otherwise -> '/'.
    // `id` stays '/' so existing installs are updated, not duplicated.
    start_url: '/launch',
    scope: '/',
    display: 'standalone',
    lang: 'en',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    background_color: '#FAF8F3',
    theme_color: '#0B6E4F',
    // purpose 'any' (not 'maskable'): the existing icons are not padded for
    // Android's maskable safe-zone, so claiming maskable would crop them. A
    // dedicated padded maskable icon is a nice-to-have follow-up.
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
