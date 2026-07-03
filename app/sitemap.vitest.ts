import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sitemap from './sitemap';

/**
 * Single-sitemap tests: the default export now returns ONE flat sitemap (static
 * marketing routes + all public Connect entity URLs), capped at the sitemaps.org
 * 50k limit, replacing the old chunked `generateSitemaps()` index. The backend
 * `/connect/sitemap/*` endpoints already return ONLY public+active rows
 * (suppressed listings / closed jobs excluded), so here we assert the web layer
 * builds the static routes, maps each entity `ref` -> the right public path, and
 * fails soft to static-only when the backend is down. Cross-module: app/sitemap.ts
 * + backend ConnectSitemapController.
 */

function jsonResponse(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) } as unknown as Response;
}

const fetchMock = vi.fn();

/** One row per section -> one entity URL per public prefix for the mapping test. */
const ONE_EACH = { stores: 1, listings: 1, companyPages: 1, profiles: 1, jobs: 1 };

function mockByUrl(
  counts: Record<string, number>,
  entries = [{ ref: 'r1', updatedAt: '2026-06-01T00:00:00.000Z' }],
) {
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith('/connect/sitemap/counts')) return Promise.resolve(jsonResponse(counts));
    return Promise.resolve(jsonResponse({ entries }));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('sitemap', () => {
  it('always includes the static marketing routes with hreflang alternates', async () => {
    mockByUrl({ stores: 0, listings: 0, companyPages: 0, profiles: 0, jobs: 0 });
    const rows = await sitemap();
    expect(rows.some((r) => r.url.endsWith('/pricing'))).toBe(true);
    expect(rows.some((r) => r.url.endsWith('/connect'))).toBe(true);
    // Marketing rows carry per-locale alternates so Google indexes each language.
    const pricing = rows.find((r) => r.url.endsWith('/pricing'));
    expect(pricing?.alternates?.languages).toBeTruthy();
  });

  it('appends each public section URL mapped to its route prefix', async () => {
    mockByUrl(ONE_EACH);
    const urls = (await sitemap()).map((r) => r.url);
    for (const expected of ['/store/r1', '/products/r1', '/company/r1', '/u/r1', '/jobs/r1']) {
      expect(urls.some((u) => u.includes(expected))).toBe(true);
    }
  });

  it('fails soft to static-only routes when the backend is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const rows = await sitemap();
    // Static routes survive; no entity URLs and never a throw.
    expect(rows.some((r) => r.url.endsWith('/pricing'))).toBe(true);
    expect(rows.some((r) => r.url.includes('/products/'))).toBe(false);
  });
});
