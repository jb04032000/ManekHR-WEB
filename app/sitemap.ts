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
 * A single `/sitemap.xml` fixes both: it is the canonical URL Search Console
 * expects AND it is already proxy-bypassed. We stay well under the sitemaps.org
 * 50k-URL limit at current scale; if public entities ever approach that limit,
 * reintroduce chunking WITH a real index route + a matching proxy bypass rule.
 *
 * Entity URLs come from the backend `@Public` `/connect/sitemap/*` projections
 * (active+approved, NON-suppressed listings, public stores/companies/profiles,
 * OPEN jobs) with `updatedAt` for `<lastmod>`, so a crawler sees exactly what a
 * user sees. Fail-soft: if the backend is unreachable we return the static
 * marketing sitemap, never a 500. Cross-module: crewroster-backend
 * ConnectSitemapController. Keep STATIC_ROUTES in sync with new marketing pages.
 */

const BASE = env.appUrl;
const API = env.serverBackendApiUrl;
/** Backend projection page size (the /connect/sitemap/<section> chunk param). */
const CHUNK_SIZE = 10000;
/** Cache window for the projection fetches (seconds). */
const REVALIDATE = 3600;
/** sitemaps.org hard limit per single file; we cap defensively. */
const MAX_URLS = 50000;

const SECTIONS = ['stores', 'listings', 'companyPages', 'profiles', 'jobs'] as const;
type Section = (typeof SECTIONS)[number];

/** URL path prefix per section - maps a backend `ref` (id/slug/handle) to its
 *  public route in app/(connect-public)/*. */
const PREFIX: Record<Section, string> = {
  stores: '/store/',
  listings: '/products/',
  companyPages: '/company/',
  profiles: '/u/',
  jobs: '/jobs/',
};

interface SitemapEntry {
  ref: string;
  updatedAt: string;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return null;
    // Backend wraps in { success, data }; tolerate both shapes.
    const body = (await res.json()) as { data?: T } & T;
    return (body?.data ?? body) as T;
  } catch {
    return null;
  }
}

async function fetchCounts(): Promise<Record<Section, number>> {
  const d = await fetchJson<Partial<Record<Section, number>>>('/connect/sitemap/counts');
  return {
    stores: d?.stores ?? 0,
    listings: d?.listings ?? 0,
    companyPages: d?.companyPages ?? 0,
    profiles: d?.profiles ?? 0,
    jobs: d?.jobs ?? 0,
  };
}

/** The static marketing routes (home + Connect deep-dives + SEO landings + guides). */
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/connect', priority: 0.9, changeFrequency: 'monthly' },
  // /textile-network: SEO landing for the "textile network / surat textile
  // networking" intent (app/(marketing)/textile-network/page.tsx). Same priority
  // band as the other Connect marketing deep-dives.
  { path: '/textile-network', priority: 0.85, changeFrequency: 'monthly' },
  { path: '/textile-marketplace', priority: 0.85, changeFrequency: 'monthly' },
  { path: '/textile-services', priority: 0.85, changeFrequency: 'monthly' },
  { path: '/textile-jobs', priority: 0.85, changeFrequency: 'monthly' },
  // /saree-wholesalers: SEO landing for the "saree wholesalers / Surat saree
  // wholesale" intent (app/(marketing)/saree-wholesalers/page.tsx).
  { path: '/saree-wholesalers', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/zari-manufacturers', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/embroidery-job-work', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/fabric-suppliers', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/dress-material-wholesalers', priority: 0.8, changeFrequency: 'monthly' },
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
 * language version. Mirrors lib/marketing/seo.ts marketingAlternates. The Connect
 * entity URLs below are NOT locale-routed (deferred), so they get no languages.
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

function staticSitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages: localeAlternates(path) },
  }));
}

/** All public URLs for one Connect entity section (walks every backend chunk). */
async function sectionUrls(section: Section, count: number): Promise<MetadataRoute.Sitemap> {
  const chunks = Math.ceil((count || 0) / CHUNK_SIZE);
  const out: MetadataRoute.Sitemap = [];
  for (let chunk = 0; chunk < chunks; chunk++) {
    const data = await fetchJson<{ entries: SitemapEntry[] }>(
      `/connect/sitemap/${section}?chunk=${chunk}`,
    );
    for (const e of data?.entries ?? []) {
      out.push({
        url: `${BASE}${PREFIX[section]}${encodeURIComponent(e.ref)}`,
        lastModified: e.updatedAt ? new Date(e.updatedAt) : undefined,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static marketing routes first (always available, no backend round-trip).
  const urls: MetadataRoute.Sitemap = [...staticSitemap()];
  const counts = await fetchCounts();
  for (const section of SECTIONS) {
    if (urls.length >= MAX_URLS) break;
    urls.push(...(await sectionUrls(section, counts[section])));
  }
  return urls.slice(0, MAX_URLS);
}
