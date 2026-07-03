import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { ConnectListingRef } from '../search.types';

/**
 * M1.6.1 - MarketplaceBrowseScreen tests.
 *
 * The screen is the client island for `/connect/marketplace`. The Server
 * Component reads the URL, runs the listings search, and hands down a
 * discriminated `state`:
 *
 *   - `browse`  -> the category-first landing prompt (no q, no facet).
 *   - `results` -> a `ListingCard` list, or the empty-for-filters state.
 *   - `error`   -> a recoverable error with a retry that refreshes.
 *
 * The embedded `ListingFacetPanel` reads `usePathname` / `useSearchParams` and
 * the retry button calls `useRouter().refresh`, so one shared nav mock covers
 * the whole tree.
 */
const { push, refresh, pathnameRef, searchParamsRef } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  pathnameRef: { current: '/connect/marketplace' },
  searchParamsRef: { current: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => pathnameRef.current,
  useSearchParams: () => searchParamsRef.current,
}));

import MarketplaceBrowseScreen, { type MarketplaceBrowseState } from './MarketplaceBrowseScreen';
import type { PromotedListingResolved } from './PromotedListingAdCard';

const LISTINGS: ConnectListingRef[] = [
  {
    listingId: 'L1',
    ownerUserId: 'u-meera',
    title: 'Heavy zari saree work',
    description: 'Hand-finished zardozi on silk',
    category: 'embroidery-zari',
    priceType: 'range',
    priceMin: 4500,
    priceMax: 8500,
    unit: 'per-piece',
    district: 'Surat',
    coverImage: null,
    verified: false,
    createdAt: '2026-05-28T12:00:00.000Z',
  },
];

const resultsState = (listings: ConnectListingRef[]): MarketplaceBrowseState => ({
  kind: 'results',
  listings,
  query: { raw: '', text: '', tags: [] },
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  pathnameRef.current = '/connect/marketplace';
  searchParamsRef.current = new URLSearchParams();
});

describe('MarketplaceBrowseScreen', () => {
  it('prompts the buyer to pick a category on the bare browse landing', () => {
    renderWithIntl(<MarketplaceBrowseScreen query="" state={{ kind: 'browse' }} />);
    expect(screen.getByText('Browse the marketplace')).toBeInTheDocument();
    // The facet panel still renders so the buyer can pick a category right away.
    expect(screen.getByRole('button', { name: 'Weaving' })).toBeInTheDocument();
  });

  it('omits seller actions from the buyer browse header (they moved to the sidebar)', () => {
    // Pure buyer browse: List your product / My listings / Inquiries now live in
    // the "Your business" sidebar group, not on this surface.
    renderWithIntl(<MarketplaceBrowseScreen query="" state={{ kind: 'browse' }} />);
    expect(screen.queryByRole('link', { name: 'List your product' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My listings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Inquiries' })).not.toBeInTheDocument();
  });

  it('shows recent listings on the landing (recent state)', () => {
    renderWithIntl(
      <MarketplaceBrowseScreen query="" state={{ kind: 'recent', listings: LISTINGS }} />,
    );
    expect(screen.getByText('Heavy zari saree work')).toBeInTheDocument();
  });

  it('renders one grid card per listing, the title linking to the detail page', () => {
    renderWithIntl(<MarketplaceBrowseScreen query="" state={resultsState(LISTINGS)} />);
    // The redesigned grid card's title is the stretched link to the listing detail.
    const titleLink = screen.getByRole('link', { name: 'Heavy zari saree work' });
    expect(titleLink.getAttribute('href')).toBe('/connect/marketplace/listing/L1');
  });

  it('shows the result count in the subtitle', () => {
    renderWithIntl(<MarketplaceBrowseScreen query="" state={resultsState(LISTINGS)} />);
    expect(screen.getByText('1 listing')).toBeInTheDocument();
  });

  it('renders the empty-for-filters state when no listings match', () => {
    renderWithIntl(<MarketplaceBrowseScreen query="zzz" state={resultsState([])} />);
    expect(screen.getByText('No listings found')).toBeInTheDocument();
  });

  it('renders a recoverable error state with a retry that refreshes', () => {
    renderWithIntl(<MarketplaceBrowseScreen query="" state={{ kind: 'error', message: 'boom' }} />);
    expect(screen.getByText('Could not load listings')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  // M2.2 - the marketplace ad rail. The Server Component resolves an optional
  // promoted listing and hands it down; the screen mounts the rail card.
  const PROMOTED: PromotedListingResolved = {
    listing: {
      _id: 'L9',
      ownerUserId: 'u-x',
      title: 'Promoted zari dupatta',
      description: 'Hand zardozi dupatta',
      category: 'embroidery-zari',
      priceType: 'fixed',
      priceMin: 1200,
      images: [],
      verified: false,
    },
    impressionToken: 'imp-1',
    campaignId: 'cmp-1',
  };

  it('renders the promoted listing card in the rail when one is provided', () => {
    renderWithIntl(
      <MarketplaceBrowseScreen query="" state={{ kind: 'browse' }} promotedListing={PROMOTED} />,
    );
    const adLink = screen.getByRole('link', { name: /Promoted zari dupatta/i });
    expect(adLink.getAttribute('href')).toBe('/connect/marketplace/listing/L9');
  });

  it('renders no promoted card when none is resolved', () => {
    renderWithIntl(
      <MarketplaceBrowseScreen query="" state={{ kind: 'browse' }} promotedListing={null} />,
    );
    expect(screen.queryByText('Promoted zari dupatta')).not.toBeInTheDocument();
  });

  /**
   * Slice B3 - the same screen in `mode="services"` powers /connect/services. It
   * swaps the hero / browse copy and the CategoryStrip set to services, and shows
   * the cross-link back to the full marketplace. The grid + card + facet rail are
   * unchanged (reuse, not a rebuild).
   */
  describe('services mode', () => {
    it('shows the services hero + pick-a-service-type landing copy', () => {
      renderWithIntl(
        <MarketplaceBrowseScreen query="" mode="services" state={{ kind: 'browse' }} />,
      );
      expect(screen.getByText('Find Services')).toBeInTheDocument();
      expect(screen.getByText('Browse services')).toBeInTheDocument();
      // The strip is constrained to service categories (the service-type filter).
      expect(screen.getByRole('button', { name: /Consulting/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Weaving/ })).not.toBeInTheDocument();
    });

    it('links back to the full marketplace from the services hero', () => {
      renderWithIntl(
        <MarketplaceBrowseScreen query="" mode="services" state={{ kind: 'browse' }} />,
      );
      const back = screen.getByRole('link', { name: /Back to the full marketplace/i });
      expect(back.getAttribute('href')).toBe('/connect/marketplace');
    });

    it('links OUT to the services browse from the marketplace hero (entry point)', () => {
      renderWithIntl(<MarketplaceBrowseScreen query="" state={{ kind: 'browse' }} />);
      const toServices = screen.getByRole('link', { name: /Find providers/i });
      expect(toServices.getAttribute('href')).toBe('/connect/services');
    });

    it('renders the services result count subtitle (providers, not listings)', () => {
      renderWithIntl(
        <MarketplaceBrowseScreen query="" mode="services" state={resultsState(LISTINGS)} />,
      );
      expect(screen.getByText('1 provider')).toBeInTheDocument();
    });
  });
});
