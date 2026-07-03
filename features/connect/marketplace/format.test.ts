import { describe, it, expect } from 'vitest';
import { formatRupees } from './format';

/**
 * M1.6.2 - `formatRupees` is the single rupee formatter shared by the listing
 * surfaces (facet panel price readout, listing detail price block). Indian
 * numbering, rupee symbol, no decimals.
 */
describe('formatRupees', () => {
  it('formats with the rupee symbol and Indian grouping, no decimals', () => {
    expect(formatRupees(4500)).toBe('₹4,500');
    expect(formatRupees(449500)).toBe('₹4,49,500');
  });

  it('formats zero', () => {
    expect(formatRupees(0)).toBe('₹0');
  });
});
