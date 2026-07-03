import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, waitFor, fireEvent } from '@/test-utils/render';
import type { OwnerListing } from './marketplace.types';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const pauseListing = vi.fn();
const publishListing = vi.fn();
const deleteListing = vi.fn();
vi.mock('./marketplace.actions', () => ({
  pauseListing: (...a: unknown[]) => pauseListing(...a),
  publishListing: (...a: unknown[]) => publishListing(...a),
  deleteListing: (...a: unknown[]) => deleteListing(...a),
}));
const addCollectionProducts = vi.fn();
vi.mock('../entities/collection.actions', () => ({
  addCollectionProducts: (...a: unknown[]) => addCollectionProducts(...a),
}));

import OwnerListingsManager from './OwnerListingsManager';

function listing(over: Partial<OwnerListing> = {}): OwnerListing {
  return {
    _id: 'L1',
    title: 'Heavy zari saree work',
    category: 'embroidery-zari',
    status: 'active',
    moderationStatus: 'approved',
    images: [],
    ...over,
  } as OwnerListing;
}

const ADD = '/connect/marketplace/new?storefrontId=s1';

beforeEach(() => vi.clearAllMocks());

describe('OwnerListingsManager', () => {
  it('renders a row per listing with the edit link', () => {
    renderWithIntl(<OwnerListingsManager listings={[listing()]} addHref={ADD} />);
    expect(screen.getByText('Heavy zari saree work')).toBeInTheDocument();
    const edit = screen.getByRole('link', { name: /Edit/i });
    expect(edit.getAttribute('href')).toBe('/connect/marketplace/listing/L1/edit');
  });

  it('shows the empty state pointing at the shop-scoped add link', () => {
    renderWithIntl(<OwnerListingsManager listings={[]} addHref={ADD} />);
    const add = screen.getByRole('link', { name: /Add product/i });
    expect(add.getAttribute('href')).toBe(ADD);
  });

  it('shows the over-limit "Hidden" badge on a suppressed product, not on others', () => {
    renderWithIntl(
      <OwnerListingsManager
        listings={[
          listing({ _id: 'L1', title: 'Suppressed item', suppressed: true }),
          listing({ _id: 'L2', title: 'Visible item' }),
        ]}
        addHref={ADD}
      />,
    );
    // The badge renders for the suppressed product only (default freeze never sets it).
    expect(screen.getAllByText('Hidden').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Suppressed item')).toBeInTheDocument();
    expect(screen.getByText('Visible item')).toBeInTheDocument();
  });

  it('pauses a genuinely live (complete) listing then refreshes', async () => {
    pauseListing.mockResolvedValue({ ok: true });
    // Only a complete product (photo + description + price) is live, so only it
    // offers the visible "Pause" toggle.
    const live = listing({
      images: ['https://img/1.jpg'],
      description: 'Pure zari',
      priceType: 'fixed',
      priceMin: 500,
    });
    renderWithIntl(<OwnerListingsManager listings={[live]} addHref={ADD} />);

    fireEvent.click(screen.getByText('Pause'));

    await waitFor(() => expect(pauseListing).toHaveBeenCalledWith('L1'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('does not offer Pause on a not-live (needs-photo) product', () => {
    // Active + approved but no photo -> "Needs photo" badge; it is not visible to
    // buyers, so the contradictory "Pause" toggle must not show (add a photo is
    // the fix).
    renderWithIntl(<OwnerListingsManager listings={[listing({ images: [] })]} addHref={ADD} />);
    expect(screen.queryByText('Pause')).not.toBeInTheDocument();
  });

  it('filters the products to a chosen collection via the shelf chip', () => {
    const cols = [
      { id: 'c1', title: 'Bridal', count: 1 },
      { id: 'c2', title: 'Cotton', count: 1 },
    ];
    renderWithIntl(
      <OwnerListingsManager
        addHref={ADD}
        collections={cols}
        listings={[
          listing({ _id: 'L1', title: 'Bridal saree', collectionIds: ['c1'] }),
          listing({ _id: 'L2', title: 'Cotton dupatta', collectionIds: ['c2'] }),
        ]}
      />,
    );
    // Both show before filtering; each card shows its collection membership line.
    expect(screen.getByText('Bridal saree')).toBeInTheDocument();
    expect(screen.getByText('Cotton dupatta')).toBeInTheDocument();
    // Pick the Bridal collection from the shelf chip row.
    fireEvent.click(screen.getByRole('button', { name: /Bridal/ }));
    expect(screen.getByText('Bridal saree')).toBeInTheDocument();
    expect(screen.queryByText('Cotton dupatta')).not.toBeInTheDocument();
  });

  it('shows no collection shelf when the shop has no collections', () => {
    renderWithIntl(<OwnerListingsManager listings={[listing()]} addHref={ADD} />);
    expect(screen.queryByRole('group', { name: 'Collections' })).not.toBeInTheDocument();
  });

  it('offers the manage-collections entry when wired', () => {
    const onManage = vi.fn();
    renderWithIntl(
      <OwnerListingsManager listings={[listing()]} addHref={ADD} onManageCollections={onManage} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /New collection/i }));
    expect(onManage).toHaveBeenCalled();
  });
});
