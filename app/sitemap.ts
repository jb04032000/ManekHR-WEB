import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { routing } from '@/i18n/routing';

/**
 * Single public sitemap served at /sitemap.xml.
 *
 * WAS a chunked `generateSitemaps()` index, but Next serves those child files at
 * `/sitemap/<id>.xml` and does NOT auto-create the `/sitemap.xml` index (it 404'd
 * in prod), AND the auth proxy (proxy.ts) only whitelists `/sitemap.xml` - not
 * `/sitemap/<id>.xml` - so crawlers hitting the chunk URLs got the sign-in wall.
 * A single `/sitemap.xml` fixes both.
 *
 * Connect product removed (2026-07-04): the backend `/connect/sitemap/*` entity
 * projections and the Connect/textile SEO landings are gone, so this is now the
 * STATIC marketing sitemap only. Keep STATIC_ROUTES in sync with new marketing
 * pages AND with proxy.ts PUBLIC_PATHS (an omission there bounces crawlers to
 * /auth).
 */

const BASE = env.appUrl;

/** The static marketing routes (home + ERP deep-dive + guides + legal). */
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  // /guides: knowledge/AEO articles (app/(marketing)/guides/*). Content in
  // components/marketing/guides.ts (GUIDES).
  { path: '/guides', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/guides/embroidery-machine-buying-guide', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/guides/embroidery-terms-glossary', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/guides/saree-fabric-guide', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/guides/how-to-start-embroidery-business', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/guides/gst-on-sarees-textiles', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/guides/embroidery-digitizing-punching', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/guides/aari-vs-zardozi', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/guides/types-of-embroidery-india', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/guides/types-of-sarees', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/erp', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
];

/**
 * Per-locale hreflang alternates for a marketing path (absolute URLs). With
 * localePrefix 'as-needed', `en` stays at the bare path; others get a `/<locale>`
 * prefix. Emitted as <xhtml:link rel="alternate" hreflang> so Google indexes each
 * language version. Mirrors lib/marketing/seo.ts marketingAlternates.
 */
function localeAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    const prefix = loc === routing.defaultLocale ? '' : `/${loc}`;
    languages[loc] = `${BASE}${prefix}${path}`;
  }
  languages['x-default'] = `${BASE}${path}`;
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  return STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages: localeAlternates(path) },
  }));
}
