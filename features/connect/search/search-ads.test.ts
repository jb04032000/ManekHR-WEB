import { describe, it, expect } from 'vitest';
import { sponsoredSearchRowIndex } from './search-ads';

describe('sponsoredSearchRowIndex', () => {
  it('returns null when there is no promoted listing', () => {
    expect(sponsoredSearchRowIndex(10, false)).toBeNull();
  });

  it('returns null when there are no organic listings (never the first result)', () => {
    expect(sponsoredSearchRowIndex(0, true)).toBeNull();
  });

  it('injects at the second position (never first) when both conditions hold', () => {
    expect(sponsoredSearchRowIndex(1, true)).toBe(1);
    expect(sponsoredSearchRowIndex(25, true)).toBe(1);
  });

  it('never returns index 0 (the first result is always organic)', () => {
    for (let n = 0; n <= 50; n++) {
      const idx = sponsoredSearchRowIndex(n, true);
      if (idx !== null) expect(idx).toBeGreaterThanOrEqual(1);
    }
  });
});
