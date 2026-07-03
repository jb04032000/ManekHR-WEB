import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';

/**
 * PromotedListingAdCard (M2.2) - the marketplace-rail promoted listing card.
 *
 * Verifies the IAB/FTC "Promoted" disclosure, the listing link target, the
 * shared click beacon wiring (`useAdBeacons` -> `recordClick`), and the
 * no-cover fallback. The ads action layer is mocked so the click beacon never
 * touches `next/headers`; the viewability beacon rides the inert
 * `IntersectionObserver` stub from `vitest.setup.ts` and never fires here.
 */
const { recordImpression, recordClick } = vi.hoisted(() => ({
  recordImpression: vi.fn(async () => undefined),
  recordClick: vi.fn(async () => undefined),
}));
vi.mock('../ads/ads.actions', () => ({ recordImpression, recordClick }));

import PromotedListingAdCard, { type PromotedListingResolved } from './PromotedListingAdCard';

const base: PromotedListingResolved = {
  listing: {
    _id: 'L9',
    ownerUserId: 'u-x',
    title: 'Promoted zari dupatta',
    description: 'Hand zardozi dupatta',
    category: 'embroidery-zari',
    priceType: 'fixed',
    priceMin: 1200,
    images: ['https://example.test/cover.jpg'],
    verified: false,
  },
  impressionToken: 'imp-1',
  campaignId: 'cmp-1',
};

beforeEach(() => {
  recordImpression.mockClear();
  recordClick.mockClear();
});

describe('PromotedListingAdCard', () => {
  it('renders the Promoted disclosure, title, and a link to the listing detail', () => {
    renderWithIntl(<PromotedListingAdCard {...base} />);
    expect(screen.getByRole('note')).toHaveAttribute('aria-label', 'Promoted');
    expect(screen.getByText('Promoted zari dupatta')).toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/connect/marketplace/listing/L9');
  });

  it('fires the click beacon with the impression token on click', () => {
    renderWithIntl(<PromotedListingAdCard {...base} />);
    screen.getByRole('link').click();
    expect(recordClick).toHaveBeenCalledWith('imp-1');
  });

  it('renders a no-cover fallback when the listing has no image', () => {
    const noImg: PromotedListingResolved = {
      ...base,
      listing: { ...base.listing, images: [] },
    };
    const { container } = renderWithIntl(<PromotedListingAdCard {...noImg} />);
    expect(container.querySelector('img')).toBeNull();
  });
});
