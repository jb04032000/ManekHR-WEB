import { describe, it, expect } from 'vitest';
import {
  resolveStateDistrict,
  seedStateDistrict,
  EMPTY_STATE_DISTRICT,
} from './StateDistrictPicker';

/**
 * Proves the StateDistrictPicker save mapping: a chosen state+district slug maps
 * to the canonical triple { district: <NAME>, geoStateSlug, geoDistrictSlug }.
 * The NAME being the india-geo district name (not a slug) is load-bearing - the
 * boost region-targeting matcher (BE ads/lib/targeting-normalize) compares a
 * targeted district NAME against ConnectProfile.district, so a slug here would
 * silently never match. seedStateDistrict round-trips a stored value (incl. a
 * legacy free-text name with no slugs) back to the two dropdown selections.
 */
describe('resolveStateDistrict (picker save mapping)', () => {
  it('maps a state+district slug pair to { district NAME, geoStateSlug, geoDistrictSlug }', () => {
    expect(resolveStateDistrict('gujarat', 'surat')).toEqual({
      district: 'Surat',
      geoStateSlug: 'gujarat',
      geoDistrictSlug: 'surat',
    });
  });

  it('writes the canonical NAME exactly as in india-geo (with bracketed alias)', () => {
    // "Banaskantha (Palanpur)" is the canonical name in the dataset; the matcher
    // matches on this exact string, so the picker must emit it verbatim.
    expect(resolveStateDistrict('gujarat', 'banaskantha-palanpur').district).toBe(
      'Banaskantha (Palanpur)',
    );
  });

  it('returns the empty triple when either slug is missing', () => {
    expect(resolveStateDistrict('gujarat', undefined)).toEqual(EMPTY_STATE_DISTRICT);
    expect(resolveStateDistrict(undefined, 'surat')).toEqual(EMPTY_STATE_DISTRICT);
    expect(resolveStateDistrict(undefined, undefined)).toEqual(EMPTY_STATE_DISTRICT);
  });

  it('returns the empty triple for slugs not in the dataset', () => {
    expect(resolveStateDistrict('atlantis', 'narnia')).toEqual(EMPTY_STATE_DISTRICT);
    expect(resolveStateDistrict('gujarat', 'not-a-district')).toEqual(EMPTY_STATE_DISTRICT);
  });
});

describe('seedStateDistrict (stored value -> dropdown selections)', () => {
  it('trusts stored slugs when present', () => {
    expect(
      seedStateDistrict({ district: 'Surat', geoStateSlug: 'gujarat', geoDistrictSlug: 'surat' }),
    ).toEqual({ stateSlug: 'gujarat', districtSlug: 'surat' });
  });

  it('recovers state+district from a legacy free-text NAME (no slugs)', () => {
    // Pre-picker rows stored only the free-text `district`. The picker still
    // opens on the right pair by matching the NAME case-insensitively.
    expect(seedStateDistrict({ district: 'surat' })).toEqual({
      stateSlug: 'gujarat',
      districtSlug: 'surat',
    });
  });

  it('returns blank selections for an empty or unrecognised value', () => {
    expect(seedStateDistrict(undefined)).toEqual({
      stateSlug: undefined,
      districtSlug: undefined,
    });
    expect(seedStateDistrict({ district: '' })).toEqual({
      stateSlug: undefined,
      districtSlug: undefined,
    });
    expect(seedStateDistrict({ district: 'Gotham' })).toEqual({
      stateSlug: undefined,
      districtSlug: undefined,
    });
  });

  it('round-trips: resolve(seed(x)) reproduces the canonical triple', () => {
    const stored = { district: 'Rajkot', geoStateSlug: 'gujarat', geoDistrictSlug: 'rajkot' };
    const { stateSlug, districtSlug } = seedStateDistrict(stored);
    expect(resolveStateDistrict(stateSlug, districtSlug)).toEqual(stored);
  });
});
