import { describe, it, expect } from 'vitest';
import { INDIA_GEO } from './india-geo';

/**
 * Integrity guard for the GENERATED india-geo dataset (web mirror). Pins the
 * counts + slug shape so this copy stays identical to the backend source (both
 * built by crewroster-backend/scripts/india-geo/build-india-geo.mjs). The
 * backend has a matching test; keep the expected numbers in sync on refresh.
 */
describe('INDIA_GEO dataset (web mirror)', () => {
  const SLUG = /^[a-z0-9-]+$/;

  it('has 35 states/UTs and 722 districts', () => {
    expect(INDIA_GEO.length).toBe(35);
    const total = INDIA_GEO.reduce((n, s) => n + s.districts.length, 0);
    expect(total).toBe(722);
  });

  it('has unique, well-formed state + district slugs', () => {
    const stateSlugs = new Set<string>();
    for (const s of INDIA_GEO) {
      expect(s.slug).toMatch(SLUG);
      expect(s.name.length).toBeGreaterThan(0);
      expect(stateSlugs.has(s.slug)).toBe(false);
      stateSlugs.add(s.slug);
      const dSlugs = new Set<string>();
      for (const d of s.districts) {
        expect(d.slug).toMatch(SLUG);
        expect(dSlugs.has(d.slug)).toBe(false);
        dSlugs.add(d.slug);
      }
    }
  });

  it('includes Gujarat (the live market) with its 33 districts', () => {
    const guj = INDIA_GEO.find((s) => s.slug === 'gujarat');
    expect(guj).toBeDefined();
    expect(guj?.isUT).toBe(false);
    expect(guj?.districts.length).toBe(33);
    expect(guj?.districts.some((d) => d.slug === 'surat')).toBe(true);
  });
});
