import { describe, it, expect, afterEach } from 'vitest';
import { waMeHref, nativeShareSupported } from './share';

/** Pure share-helper tests. Cross-module: components/connect/ShareButton.tsx. */

describe('waMeHref', () => {
  it('builds a bare wa.me share link with URL-encoded text', () => {
    const href = waMeHref('Check this on ManekHR: Saree https://z/products/1');
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    // spaces + colon + slashes must be percent-encoded (no raw spaces).
    expect(href).not.toContain(' ');
    expect(decodeURIComponent(href.replace('https://wa.me/?text=', ''))).toBe(
      'Check this on ManekHR: Saree https://z/products/1',
    );
  });
});

describe('nativeShareSupported', () => {
  const original = (navigator as Navigator & { share?: unknown }).share;
  afterEach(() => {
    if (original === undefined) delete (navigator as unknown as Record<string, unknown>).share;
    else (navigator as Navigator & { share?: unknown }).share = original;
  });

  it('is false when navigator.share is absent', () => {
    delete (navigator as unknown as Record<string, unknown>).share;
    expect(nativeShareSupported()).toBe(false);
  });

  it('is true when navigator.share is a function', () => {
    (navigator as Navigator & { share?: unknown }).share = () => Promise.resolve();
    expect(nativeShareSupported()).toBe(true);
  });
});
