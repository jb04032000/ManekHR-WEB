import { describe, it, expect } from 'vitest';

/**
 * M1.6.1 - URL-param coercion for the marketplace browse page.
 *
 * `/connect/marketplace` is a listings-only browse surface. Its Server
 * Component folds the URL `searchParams` into the typed `SearchConnectAllInput`
 * the `searchConnectAll` action consumes, always pinned to `type: 'listings'`.
 * The reader is strict and reuses the same primitive coercion the federated
 * search page uses (`category` whitelist, non-negative price bounds), so a
 * listing facet behaves identically whether it arrives on `/connect/search`
 * or `/connect/marketplace`.
 *
 * `priceRangeToParams` is the pure half of the price-range slider: it maps a
 * `[min, max]` slider value to the `priceMin` / `priceMax` params, dropping a
 * bound that sits at the slider extreme (0 = no floor, PRICE_MAX = no ceiling)
 * so an untouched slider never narrows the search.
 */

import {
  readMarketplaceBrowseInput,
  readServicesBrowseInput,
  withServicesBlend,
  priceRangeToParams,
  PRICE_MAX,
} from './url-params';
import { SERVICE_CATEGORY_SLUGS } from '../search.types';

describe('readMarketplaceBrowseInput', () => {
  it('pins type to listings for a fully blank input', () => {
    expect(readMarketplaceBrowseInput({})).toEqual({ q: '', type: 'listings' });
  });

  it('trims the q scalar and keeps the listings type', () => {
    expect(readMarketplaceBrowseInput({ q: '  cotton voile  ' })).toEqual({
      q: 'cotton voile',
      type: 'listings',
    });
  });

  it('takes the first value when q arrives as a repeated key', () => {
    expect(readMarketplaceBrowseInput({ q: ['zari', 'silk'] })).toEqual({
      q: 'zari',
      type: 'listings',
    });
  });

  it('forwards a valid listing category from the textile taxonomy', () => {
    expect(readMarketplaceBrowseInput({ category: 'embroidery-zari' })).toEqual({
      q: '',
      type: 'listings',
      filters: { category: 'embroidery-zari' },
    });
  });

  it('drops an unknown category so the backend never sees an invalid one', () => {
    expect(readMarketplaceBrowseInput({ category: 'not-a-category' })).toEqual({
      q: '',
      type: 'listings',
    });
  });

  it('forwards a district scalar', () => {
    expect(readMarketplaceBrowseInput({ district: 'Surat' })).toEqual({
      q: '',
      type: 'listings',
      filters: { district: 'Surat' },
    });
  });

  it('coerces priceMin / priceMax to non-negative numbers', () => {
    expect(readMarketplaceBrowseInput({ priceMin: '1000', priceMax: '5000' })).toEqual({
      q: '',
      type: 'listings',
      filters: { priceMin: 1000, priceMax: 5000 },
    });
  });

  it('drops a negative or non-numeric price bound', () => {
    expect(readMarketplaceBrowseInput({ priceMin: '-100' })).toEqual({
      q: '',
      type: 'listings',
    });
    expect(readMarketplaceBrowseInput({ priceMax: 'abc' })).toEqual({
      q: '',
      type: 'listings',
    });
  });

  it('combines q and every listing facet in one payload', () => {
    expect(
      readMarketplaceBrowseInput({
        q: 'saree',
        category: 'finished-goods',
        district: 'Surat',
        priceMin: '500',
        priceMax: '9000',
      }),
    ).toEqual({
      q: 'saree',
      type: 'listings',
      filters: {
        category: 'finished-goods',
        district: 'Surat',
        priceMin: 500,
        priceMax: 9000,
      },
    });
  });

  it('omits the filters key when every facet is absent', () => {
    const out = readMarketplaceBrowseInput({ q: 'zari' });
    expect(out).toEqual({ q: 'zari', type: 'listings' });
    expect(Object.prototype.hasOwnProperty.call(out, 'filters')).toBe(false);
  });
});

/**
 * Slice B3 - the Services browse (`/connect/services`) input reader. Services are
 * just listings with a service category, so the service-type sub-filter maps to
 * the SAME single-select `?category=` BE filter the marketplace uses - this
 * helper just CLAMPS the category to a service category so the services route
 * stays service-scoped (a non-service category like `machinery` is dropped).
 */
describe('readServicesBrowseInput', () => {
  it('maps a NEW service category straight to the BE category filter', () => {
    expect(readServicesBrowseInput({ category: 'machine-repair' })).toEqual({
      q: '',
      type: 'listings',
      filters: { category: 'machine-repair' },
    });
  });

  it('keeps a pre-existing service-ish trade category (dyeing) as a service type', () => {
    expect(readServicesBrowseInput({ category: 'dyeing' })).toEqual({
      q: '',
      type: 'listings',
      filters: { category: 'dyeing' },
    });
  });

  it('DROPS a non-service category so /connect/services cannot show products', () => {
    // `machinery` is a valid marketplace category but NOT a service - the services
    // route must never be steered into it. The clamp removes it.
    const out = readServicesBrowseInput({ category: 'machinery' });
    expect(out).toEqual({ q: '', type: 'listings' });
    expect(out.filters).toBeUndefined();
  });

  it('keeps the OTHER facets when it drops a non-service category', () => {
    // Dropping the bad category must not wipe district / price; those still apply.
    expect(readServicesBrowseInput({ category: 'finished-goods', district: 'Surat' })).toEqual({
      q: '',
      type: 'listings',
      filters: { district: 'Surat' },
    });
  });

  it('passes a query + service type + location through unchanged', () => {
    expect(
      readServicesBrowseInput({ q: 'urgent', category: 'transport', district: 'Surat' }),
    ).toEqual({
      q: 'urgent',
      type: 'listings',
      filters: { category: 'transport', district: 'Surat' },
    });
  });
});

/**
 * `withServicesBlend` powers the `/connect/services` "all services" default: with
 * NO single service type picked it blends the whole `SERVICE_CATEGORY_SLUGS` set
 * into `categoryIn` (so the page shows every service category at once); with a
 * service type picked it leaves the single `category` filter to narrow to that one
 * type. Products never bleed in because the blend is the service set only.
 */
describe('withServicesBlend', () => {
  it('blends the full service set when no service type is picked (bare browse)', () => {
    const out = withServicesBlend(readServicesBrowseInput({}));
    expect(out).toEqual({
      q: '',
      type: 'listings',
      filters: { categoryIn: [...SERVICE_CATEGORY_SLUGS] },
    });
  });

  it('blends the service set alongside other facets when no type is picked', () => {
    // District / price still apply; the blend just adds the service-category set.
    const out = withServicesBlend(readServicesBrowseInput({ district: 'Surat', priceMin: '500' }));
    expect(out).toEqual({
      q: '',
      type: 'listings',
      filters: { district: 'Surat', priceMin: 500, categoryIn: [...SERVICE_CATEGORY_SLUGS] },
    });
  });

  it('blends the service set on a query-only browse (no type)', () => {
    const out = withServicesBlend(readServicesBrowseInput({ q: 'transport' }));
    expect(out).toEqual({
      q: 'transport',
      type: 'listings',
      filters: { categoryIn: [...SERVICE_CATEGORY_SLUGS] },
    });
  });

  it('narrows to the single category (no blend) when a service type IS picked', () => {
    const out = withServicesBlend(readServicesBrowseInput({ category: 'transport' }));
    expect(out).toEqual({
      q: '',
      type: 'listings',
      filters: { category: 'transport' },
    });
    // No blended set when a single type narrows the surface.
    expect(out.filters?.categoryIn).toBeUndefined();
  });

  it('only ever blends service slugs, never a product category (no bleed)', () => {
    // A dropped non-service category (machinery) leaves no `category`, so the
    // blend kicks in - but the blended set is the service slugs ONLY, so the
    // products surface can never appear on /connect/services.
    const out = withServicesBlend(readServicesBrowseInput({ category: 'machinery' }));
    expect(out.filters?.category).toBeUndefined();
    expect(out.filters?.categoryIn).toEqual([...SERVICE_CATEGORY_SLUGS]);
    // Every blended slug is a real service slug (sanity: no product slug bled in).
    for (const slug of out.filters?.categoryIn ?? []) {
      expect((SERVICE_CATEGORY_SLUGS as readonly string[]).includes(slug)).toBe(true);
    }
  });
});

describe('priceRangeToParams', () => {
  it('drops both bounds when the slider spans the full range', () => {
    expect(priceRangeToParams([0, PRICE_MAX])).toEqual({});
  });

  it('keeps only the floor when the max sits at the slider ceiling', () => {
    expect(priceRangeToParams([1000, PRICE_MAX])).toEqual({ priceMin: 1000 });
  });

  it('keeps only the ceiling when the min sits at zero', () => {
    expect(priceRangeToParams([0, 50000])).toEqual({ priceMax: 50000 });
  });

  it('keeps both bounds when the slider is narrowed on both ends', () => {
    expect(priceRangeToParams([1000, 50000])).toEqual({ priceMin: 1000, priceMax: 50000 });
  });

  it('exposes a positive PRICE_MAX ceiling constant', () => {
    expect(PRICE_MAX).toBeGreaterThan(0);
  });
});
