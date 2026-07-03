import { describe, it, expect } from 'vitest';
import { entitySeo, notFoundSeo } from './seo-meta';

/**
 * Metadata-presence + noindex tests for the shared public-page SEO builder.
 * Every public page must ship: a canonical, an OG block, a Twitter summary card,
 * and an OG image (entity cover OR the brand fallback). A suppressed / not-found
 * / empty state must be noindex. Cross-module: lib/connect/seo-meta.ts.
 */

describe('entitySeo', () => {
  it('emits canonical + OG + Twitter + an indexable robots policy by default', () => {
    const m = entitySeo({
      path: '/store/surat-silks',
      title: 'Surat Silks',
      description: 'Wholesale sarees',
      image: 'https://cdn/banner.jpg',
      ogType: 'website',
    });
    expect(m.alternates?.canonical).toBe('/store/surat-silks');
    expect(m.robots).toEqual({ index: true, follow: true });
    expect(m.openGraph?.images).toEqual([{ url: 'https://cdn/banner.jpg' }]);
    const tw = m.twitter as { images?: unknown };
    expect(tw.images).toEqual(['https://cdn/banner.jpg']);
    const og = m.openGraph as { url?: unknown };
    expect(og.url).toBe('/store/surat-silks');
  });

  it('falls back to the static brand OG image when the entity has no cover', () => {
    const m = entitySeo({ path: '/u/x', title: 'X', description: 'd' });
    expect(m.openGraph?.images).toEqual([{ url: '/opengraph-image.png' }]);
  });

  it('is noindex when index:false (suppressed / empty state)', () => {
    const m = entitySeo({ path: '/products/x', title: 'X', description: 'd', index: false });
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});

describe('notFoundSeo', () => {
  it('is noindex (a 404 / suppressed entity must never be indexed)', () => {
    const m = notFoundSeo('Not found');
    expect(m.title).toBe('Not found');
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});
