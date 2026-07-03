import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { ConnectListingRef } from '@/features/connect/search.types';
import ListingCard from './ListingCard';

/**
 * M1.6.2 - ListingCard now links its title to the listing detail page (the
 * detail surface did not exist in M1.4.3). The seller link is preserved.
 */
const LISTING: ConnectListingRef = {
  listingId: 'L1',
  ownerUserId: 'u-meera',
  title: 'Heavy zari saree work',
  description: '',
  category: 'embroidery-zari',
  priceType: 'range',
  priceMin: 4500,
  priceMax: 8500,
  unit: 'per-piece',
  district: 'Surat',
  coverImage: null,
  verified: false,
  createdAt: '2026-05-28T12:00:00.000Z',
};

describe('ListingCard', () => {
  it('links the title to the listing detail page', () => {
    renderWithIntl(<ListingCard listing={LISTING} />);
    const titleLink = screen.getByRole('link', { name: 'Heavy zari saree work' });
    expect(titleLink.getAttribute('href')).toBe('/connect/marketplace/listing/L1');
  });

  it('points the View product link at the listing detail (not the seller)', () => {
    renderWithIntl(<ListingCard listing={LISTING} />);
    const productLink = screen.getByRole('link', { name: 'View product' });
    expect(productLink.getAttribute('href')).toBe('/connect/marketplace/listing/L1');
  });

  it('humanizes a custom category instead of throwing MISSING_MESSAGE', () => {
    // A seller-coined category ("new cat") has no i18n key; the card must render
    // a humanized label, never crash on the missing message.
    renderWithIntl(<ListingCard listing={{ ...LISTING, category: 'new cat' }} />);
    expect(screen.getByText('New cat')).toBeInTheDocument();
  });

  it('shows a Verified marker when the seller is verified (M2.3)', () => {
    renderWithIntl(<ListingCard listing={{ ...LISTING, verified: true }} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('shows no Verified marker for an unverified seller', () => {
    renderWithIntl(<ListingCard listing={LISTING} />);
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });

  it('shows a play badge only when the listing has a video', () => {
    renderWithIntl(<ListingCard listing={LISTING} />);
    expect(screen.queryByTitle('Has video')).not.toBeInTheDocument();

    renderWithIntl(<ListingCard listing={{ ...LISTING, hasVideo: true }} />);
    expect(screen.getByTitle('Has video')).toBeInTheDocument();
  });

  it('exposes the verified explanation to assistive tech (M2.5)', () => {
    // The hint must reach screen readers, not only mouse hover via title.
    renderWithIntl(<ListingCard listing={{ ...LISTING, verified: true }} />);
    expect(screen.getByText('Verified')).toHaveAccessibleName(/verified plan/i);
  });
});
