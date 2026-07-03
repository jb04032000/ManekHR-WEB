import { describe, it, expect } from 'vitest';
import { toAbsoluteBannerUrl } from './banner-url';

describe('toAbsoluteBannerUrl', () => {
  it('prepends https:// to a bare domain so it is not treated as relative', () => {
    expect(toAbsoluteBannerUrl('manekhr.in')).toBe('https://manekhr.in');
  });

  it('prepends https:// to a www / path form', () => {
    expect(toAbsoluteBannerUrl('www.manekhr.in/offers')).toBe('https://www.manekhr.in/offers');
  });

  it('passes an http(s) URL through unchanged', () => {
    expect(toAbsoluteBannerUrl('https://shop.example.com')).toBe('https://shop.example.com');
    expect(toAbsoluteBannerUrl('http://x.com')).toBe('http://x.com');
  });

  it('is case-insensitive about the scheme', () => {
    expect(toAbsoluteBannerUrl('HTTPS://x.com')).toBe('HTTPS://x.com');
  });

  it('keeps mailto/tel schemes', () => {
    expect(toAbsoluteBannerUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(toAbsoluteBannerUrl('tel:+919999999999')).toBe('tel:+919999999999');
  });

  it('upgrades a protocol-relative URL to https', () => {
    expect(toAbsoluteBannerUrl('//cdn.example.com/x')).toBe('https://cdn.example.com/x');
  });

  it('trims surrounding whitespace', () => {
    expect(toAbsoluteBannerUrl('  manekhr.in  ')).toBe('https://manekhr.in');
  });

  it('returns empty for empty / whitespace-only input (stays non-clickable)', () => {
    expect(toAbsoluteBannerUrl('')).toBe('');
    expect(toAbsoluteBannerUrl('   ')).toBe('');
  });
});
