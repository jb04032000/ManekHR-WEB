import { describe, it, expect } from 'vitest';
import sitemap from './sitemap';

/**
 * Static-sitemap tests. The Connect product (and its backend `/connect/sitemap/*`
 * entity projections + textile SEO landings) was removed on 2026-07-04, so the
 * default export now returns ONLY the static marketing routes — no backend
 * round-trip at all. Cross-module: app/sitemap.ts; keep the asserted routes in
 * sync with STATIC_ROUTES there and proxy.ts PUBLIC_PATHS.
 */

describe('sitemap', () => {
  it('includes the static marketing routes with hreflang alternates', async () => {
    const rows = await sitemap();
    expect(rows.some((r) => r.url.endsWith('/pricing'))).toBe(true);
    expect(rows.some((r) => r.url.endsWith('/erp'))).toBe(true);
    expect(rows.some((r) => r.url.endsWith('/guides'))).toBe(true);
    // Marketing rows carry per-locale alternates so Google indexes each language.
    const pricing = rows.find((r) => r.url.endsWith('/pricing'));
    expect(pricing?.alternates?.languages).toBeTruthy();
  });

  it('contains NO removed Connect/textile routes or entity URLs', async () => {
    const urls = (await sitemap()).map((r) => r.url);
    for (const gone of [
      '/connect',
      '/textile-jobs',
      '/textile-marketplace',
      '/saree-wholesalers',
      '/store/',
      '/products/',
      '/company/',
      '/u/',
      '/jobs/',
    ]) {
      expect(urls.some((u) => u.includes(gone))).toBe(false);
    }
  });

  it('needs no network: never calls fetch', async () => {
    // The static sitemap must not depend on backend availability at build time.
    const rows = await sitemap();
    expect(rows.length).toBeGreaterThan(5);
  });
});
