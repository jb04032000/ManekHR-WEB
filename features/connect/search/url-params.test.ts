import { describe, it, expect } from 'vitest';

/**
 * S1.6.2 contract tests for the URL-search-params coercion helper used by
 * `app/connect/search/page.tsx`.
 *
 * Next.js hands a Server Component `searchParams` whose values are each
 * `string | string[] | undefined`. The helper folds that into the typed
 * `SearchConnectAllInput` the action consumes. Strict by design:
 *
 *   - `q` is trimmed; the first value of a repeated key wins.
 *   - `type` is whitelisted to the queryable backend SearchType values
 *     (`all` / `people` / `listings` post-M1.4.2). Anything else is dropped
 *     so the action never forwards a value the backend would 400 on.
 *   - `skills` accepts either repeated-key (`?skills=a&skills=b` -> array) or
 *     scalar (`?skills=a` -> single-element array). Blank-string entries are
 *     dropped.
 *   - `district` is a plain scalar.
 *   - `openToWork` is strict: only the literal strings `'true'` / `'false'`
 *     coerce to a boolean. Anything else is dropped so a typo like `?openToWork=yes`
 *     does not silently filter.
 *   - When every filter is undefined the `filters` key is omitted so the action's
 *     param object stays minimal.
 */

import { readSearchInput, readSelectedTab, removeTagFromQuery } from './url-params';

describe('readSearchInput', () => {
  it('returns empty q for a fully blank input', () => {
    expect(readSearchInput({})).toEqual({ q: '' });
  });

  it('trims the q scalar and forwards nothing else', () => {
    expect(readSearchInput({ q: '  zari  ' })).toEqual({ q: 'zari' });
  });

  it('takes the first value when q arrives as a repeated key', () => {
    expect(readSearchInput({ q: ['zari', 'silk'] })).toEqual({ q: 'zari' });
  });

  it('forwards a valid type whitelist value', () => {
    expect(readSearchInput({ q: 'zari', type: 'people' })).toEqual({
      q: 'zari',
      type: 'people',
    });
    expect(readSearchInput({ q: 'zari', type: 'all' })).toEqual({ q: 'zari', type: 'all' });
    expect(readSearchInput({ q: 'zari', type: 'listings' })).toEqual({
      q: 'zari',
      type: 'listings',
    });
    expect(readSearchInput({ q: 'zari', type: 'jobs' })).toEqual({
      q: 'zari',
      type: 'jobs',
    });
  });

  it('drops an unknown type so the backend never sees an invalid SearchType', () => {
    expect(readSearchInput({ q: 'zari', type: 'foo' })).toEqual({ q: 'zari' });
  });

  it('reads skills as repeated keys (array form)', () => {
    expect(readSearchInput({ q: 'zari', skills: ['embroidery', 'zardozi'] })).toEqual({
      q: 'zari',
      filters: { skills: ['embroidery', 'zardozi'] },
    });
  });

  it('lifts a scalar skills value into a single-element array', () => {
    expect(readSearchInput({ q: 'zari', skills: 'embroidery' })).toEqual({
      q: 'zari',
      filters: { skills: ['embroidery'] },
    });
  });

  it('drops blank skill entries instead of forwarding empty strings', () => {
    expect(readSearchInput({ q: 'zari', skills: ['embroidery', '', '  '] })).toEqual({
      q: 'zari',
      filters: { skills: ['embroidery'] },
    });
  });

  it('forwards a district scalar', () => {
    expect(readSearchInput({ q: 'zari', district: 'surat' })).toEqual({
      q: 'zari',
      filters: { district: 'surat' },
    });
  });

  it('coerces openToWork only on the literal true / false strings', () => {
    expect(readSearchInput({ q: 'zari', openToWork: 'true' })).toEqual({
      q: 'zari',
      filters: { openToWork: true },
    });
    expect(readSearchInput({ q: 'zari', openToWork: 'false' })).toEqual({
      q: 'zari',
      filters: { openToWork: false },
    });
    expect(readSearchInput({ q: 'zari', openToWork: 'yes' })).toEqual({ q: 'zari' });
  });

  it('coerces providingServices only on the literal true / false strings', () => {
    expect(readSearchInput({ q: 'zari', providingServices: 'true' })).toEqual({
      q: 'zari',
      filters: { providingServices: true },
    });
    expect(readSearchInput({ q: 'zari', providingServices: 'false' })).toEqual({
      q: 'zari',
      filters: { providingServices: false },
    });
    expect(readSearchInput({ q: 'zari', providingServices: 'yes' })).toEqual({ q: 'zari' });
  });

  it('forwards a valid listing category from the textile taxonomy', () => {
    expect(readSearchInput({ q: 'zari', category: 'embroidery-zari' })).toEqual({
      q: 'zari',
      filters: { category: 'embroidery-zari' },
    });
  });

  it('drops an unknown category so the backend never sees an invalid one', () => {
    expect(readSearchInput({ q: 'zari', category: 'not-a-category' })).toEqual({ q: 'zari' });
  });

  it('coerces priceMin / priceMax to non-negative numbers', () => {
    expect(
      readSearchInput({ q: '', category: 'weaving', priceMin: '1000', priceMax: '5000' }),
    ).toEqual({
      q: '',
      filters: { category: 'weaving', priceMin: 1000, priceMax: 5000 },
    });
  });

  it('drops a negative or non-numeric price bound', () => {
    expect(readSearchInput({ q: 'zari', priceMin: '-100' })).toEqual({ q: 'zari' });
    expect(readSearchInput({ q: 'zari', priceMax: 'abc' })).toEqual({ q: 'zari' });
  });

  it('combines q, type, and all filters in one payload', () => {
    expect(
      readSearchInput({
        q: '#zardozi',
        type: 'people',
        skills: ['zari', 'embroidery'],
        district: 'surat',
        openToWork: 'true',
      }),
    ).toEqual({
      q: '#zardozi',
      type: 'people',
      filters: { skills: ['zari', 'embroidery'], district: 'surat', openToWork: true },
    });
  });

  it('omits the filters key when every facet is undefined', () => {
    const out = readSearchInput({ q: 'zari', type: 'people' });
    expect(out).toEqual({ q: 'zari', type: 'people' });
    expect(Object.prototype.hasOwnProperty.call(out, 'filters')).toBe(false);
  });

  it('reads ?tag=<slug> into filters.tags as a single-element array', () => {
    expect(readSearchInput({ tag: 'kanjivaram' })).toEqual({
      q: '',
      filters: { tags: ['kanjivaram'] },
    });
  });

  it('trims whitespace from the tag slug', () => {
    expect(readSearchInput({ tag: '  zari  ' })).toEqual({
      q: '',
      filters: { tags: ['zari'] },
    });
  });

  it('drops an empty or blank tag so filters.tags is never set to an empty entry', () => {
    expect(readSearchInput({ tag: '' })).toEqual({ q: '' });
    expect(readSearchInput({ tag: '   ' })).toEqual({ q: '' });
  });

  it('takes the first value when tag arrives as a repeated key', () => {
    expect(readSearchInput({ tag: ['kanjivaram', 'banarasi'] })).toEqual({
      q: '',
      filters: { tags: ['kanjivaram'] },
    });
  });
});

describe('readSelectedTab', () => {
  it('defaults to "all" when type is absent', () => {
    expect(readSelectedTab({})).toBe('all');
  });

  it('returns the type when it is one of the five selectable tabs', () => {
    expect(readSelectedTab({ type: 'all' })).toBe('all');
    expect(readSelectedTab({ type: 'people' })).toBe('people');
    expect(readSelectedTab({ type: 'posts' })).toBe('posts');
    expect(readSelectedTab({ type: 'listings' })).toBe('listings');
    expect(readSelectedTab({ type: 'jobs' })).toBe('jobs');
  });

  it('falls back to "all" for an unknown value so the tab strip is never in an invalid state', () => {
    expect(readSelectedTab({ type: 'foo' })).toBe('all');
    expect(readSelectedTab({ type: '' })).toBe('all');
  });

  it('takes the first value when type arrives as a repeated key', () => {
    expect(readSelectedTab({ type: ['people', 'jobs'] })).toBe('people');
  });
});

describe('removeTagFromQuery', () => {
  it('strips a hashtag token that sits between other text', () => {
    expect(removeTagFromQuery('zari #moti silk', 'moti')).toBe('zari silk');
  });

  it('strips a hashtag at the very start of the query', () => {
    expect(removeTagFromQuery('#moti zari', 'moti')).toBe('zari');
  });

  it('strips a hashtag at the very end of the query', () => {
    expect(removeTagFromQuery('zari #moti', 'moti')).toBe('zari');
  });

  it('returns an empty string when the only token in the query was the hashtag', () => {
    expect(removeTagFromQuery('#moti', 'moti')).toBe('');
  });

  it('removes every occurrence when the same hashtag appears multiple times', () => {
    expect(removeTagFromQuery('#moti zari #moti silk #moti', 'moti')).toBe('zari silk');
  });

  it('leaves the query untouched when the slug is not present', () => {
    expect(removeTagFromQuery('zari silk', 'moti')).toBe('zari silk');
  });

  it('matches case-insensitively so an uppercase hashtag still strips', () => {
    expect(removeTagFromQuery('#MOTI zari', 'moti')).toBe('zari');
  });

  it('does not strip a hashtag that is only a prefix of a different token', () => {
    // `#motipearl` is its own canonical tag, not a `#moti` followed by `pearl`.
    expect(removeTagFromQuery('#motipearl zari', 'moti')).toBe('#motipearl zari');
  });
});
