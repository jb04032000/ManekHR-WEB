import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, within } from '@/test-utils/render';
import type { ConnectListingRef } from '../search.types';

/**
 * Marketplace grid PROMOTED-at-top tests (Connect boost fix).
 *
 * Covers the fix that makes a funded `marketplace_grid` listing boost render as a
 * clearly-labelled PROMOTED unit pinned at the TOP of the product grid, on ALL
 * breakpoints including mobile - independent of the desktop-only `xl` rail. The
 * grid card renders as a normal ListingGridCard (via MarketplaceGridAdCell ->
 * PromotedGridListingCard) with a "Promoted" chip, so it has the same anatomy as
 * an organic card (title link + a "Get quotation" footer link).
 *
 * Same shared nav mock as MarketplaceBrowseScreen.test (the embedded
 * ListingFacetPanel + retry read next/navigation). The ads action layer is mocked
 * so the click beacon never touches next/headers; the impression beacon rides the
 * inert IntersectionObserver stub from vitest.setup.ts.
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

const { recordImpression, recordClick } = vi.hoisted(() => ({
  recordImpression: vi.fn(async () => undefined),
  recordClick: vi.fn(async () => undefined),
}));
vi.mock('../ads/ads.actions', () => ({ recordImpression, recordClick }));

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
  {
    listingId: 'L2',
    ownerUserId: 'u-arif',
    title: 'Power loom for sale',
    description: 'Used power loom, good condition',
    category: 'machinery',
    priceType: 'fixed',
    priceMin: 65000,
    priceMax: null,
    unit: 'per-piece',
    district: 'Surat',
    coverImage: null,
    verified: false,
    createdAt: '2026-05-27T12:00:00.000Z',
  },
];

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

const resultsState = (listings: ConnectListingRef[]): MarketplaceBrowseState => ({
  kind: 'results',
  listings,
  query: { raw: '', text: '', tags: [] },
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  recordImpression.mockClear();
  recordClick.mockClear();
  pathnameRef.current = '/connect/marketplace';
  searchParamsRef.current = new URLSearchParams();
  // Reset the viewport to a desktop default before each case.
  window.innerWidth = 1280;
});

describe('Marketplace grid - promoted listing pinned at the top', () => {
  it('renders the grid promoted card as the FIRST cell of the product grid', () => {
    renderWithIntl(
      <MarketplaceBrowseScreen
        query=""
        state={resultsState(LISTINGS)}
        gridPromotedListing={PROMOTED}
      />,
    );

    // The grid is the labelled product list. Its first cell must be the promoted
    // boost, BEFORE any organic product card.
    const grid = screen.getByRole('list', { name: 'Marketplace listings' });
    const cells = within(grid).getAllByRole('listitem');
    const firstCell = cells[0];

    // The first cell carries the Promoted disclosure + links to the boosted listing.
    // ListingGridCard has two links (title + footer CTA); both point to the detail.
    expect(within(firstCell).getByText('Promoted zari dupatta')).toBeInTheDocument();
    const firstLink = within(firstCell).getAllByRole('link')[0];
    expect(firstLink.getAttribute('href')).toBe('/connect/marketplace/listing/L9');

    // The organic products come AFTER the promoted top cell.
    expect(within(cells[1]).getByText('Heavy zari saree work')).toBeInTheDocument();
  });

  it('the promoted top card carries the Promoted disclosure label (IAB/FTC)', () => {
    renderWithIntl(
      <MarketplaceBrowseScreen
        query=""
        state={resultsState(LISTINGS)}
        gridPromotedListing={PROMOTED}
      />,
    );
    // ListingGridCard's promoted chip exposes the disclosure as role="note".
    const note = screen.getByRole('note', { name: 'Promoted' });
    expect(note).toBeInTheDocument();
  });

  it('fires the shared click beacon (MRC) when the promoted top card is clicked', () => {
    renderWithIntl(
      <MarketplaceBrowseScreen
        query=""
        state={resultsState(LISTINGS)}
        gridPromotedListing={PROMOTED}
      />,
    );
    const grid = screen.getByRole('list', { name: 'Marketplace listings' });
    const firstCell = within(grid).getAllByRole('listitem')[0];
    // Click bubbles from the card's detail link up to the beacon wrapper's onClick.
    within(firstCell).getAllByRole('link')[0].click();
    expect(recordClick).toHaveBeenCalledWith('imp-1');
  });

  it('renders the promoted top card at a MOBILE width (not gated behind the xl rail)', () => {
    // Simulate a narrow phone. The top promoted cell lives in the grid markup, not
    // the desktop-only rail, so it must still render. jsdom does not apply CSS
    // breakpoints, so this asserts the card is in the grid regardless of width -
    // exactly the property the fix guarantees (no xl-rail dependency).
    window.innerWidth = 360;
    renderWithIntl(
      <MarketplaceBrowseScreen
        query=""
        state={resultsState(LISTINGS)}
        gridPromotedListing={PROMOTED}
      />,
    );
    const grid = screen.getByRole('list', { name: 'Marketplace listings' });
    const firstCell = within(grid).getAllByRole('listitem')[0];
    expect(within(firstCell).getByText('Promoted zari dupatta')).toBeInTheDocument();
  });

  it('renders no grid promoted card when none is resolved (no empty hole)', () => {
    renderWithIntl(
      <MarketplaceBrowseScreen
        query=""
        state={resultsState(LISTINGS)}
        gridPromotedListing={null}
      />,
    );
    expect(screen.queryByText('Promoted zari dupatta')).not.toBeInTheDocument();
    // The grid still leads with the first organic product.
    const grid = screen.getByRole('list', { name: 'Marketplace listings' });
    const firstCell = within(grid).getAllByRole('listitem')[0];
    expect(within(firstCell).getByText('Heavy zari saree work')).toBeInTheDocument();
  });
});
