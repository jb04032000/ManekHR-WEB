import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';
import type { OwnerListing } from './marketplace.types';

/**
 * M1.6.4 - EditListingScreen wraps the shared ListingForm prefilled from the
 * owner's listing and PATCHes via the mocked `updateListing`. Moderation is off,
 * so editing a live listing keeps it live; the success copy just confirms saved.
 */
const { refresh, push } = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
  usePathname: () => '/connect/marketplace/listing/L1/edit',
  useSearchParams: () => new URLSearchParams(),
}));
const { updateListing, pauseListing, publishListing } = vi.hoisted(() => ({
  updateListing: vi.fn(),
  pauseListing: vi.fn(),
  publishListing: vi.fn(),
}));
vi.mock('./marketplace.actions', () => ({ updateListing, pauseListing, publishListing }));
vi.mock('./tag.actions', () => ({ searchTags: vi.fn(async () => ({ ok: true, data: [] })) }));
vi.mock('../entities/collection.actions', () => ({
  setListingCollections: vi.fn(async () => ({ ok: true, data: { collectionIds: [] } })),
  createCollection: vi.fn(async () => ({ ok: true, data: { _id: 'c-new', title: 'New' } })),
}));
vi.mock('@/components/connect/MediaUploadGrid', () => ({
  default: ({ onChange }: { onChange: (urls: string[]) => void }) => (
    <button type="button" onClick={() => onChange(['https://img/new.jpg'])}>
      mock-upload
    </button>
  ),
}));

import EditListingScreen from './EditListingScreen';

const LISTING: OwnerListing = {
  _id: 'L1',
  ownerUserId: 'u',
  storefrontId: 'SF1',
  title: 'Existing title',
  description: 'old description',
  category: 'weaving',
  priceType: 'negotiable',
  status: 'active',
  moderationStatus: 'approved',
  images: [],
};

beforeEach(() => {
  updateListing.mockReset();
  pauseListing.mockReset();
  publishListing.mockReset();
  refresh.mockReset();
});

// The Connect shell wraps pages in AntD's <App> (message context); mirror it.
const renderScreen = (listing: OwnerListing) =>
  renderWithIntl(
    <AntApp>
      <EditListingScreen listing={listing} />
    </AntApp>,
  );

describe('EditListingScreen', () => {
  it('prefills the form from the listing', () => {
    renderScreen(LISTING);
    expect(screen.getByDisplayValue('Existing title')).toBeInTheDocument();
  });

  it('pauses an active listing from the status control then refreshes', async () => {
    pauseListing.mockResolvedValueOnce({ ok: true, data: { _id: 'L1' } });
    renderScreen(LISTING);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(pauseListing).toHaveBeenCalledWith('L1'));
    expect(refresh).toHaveBeenCalled();
  });

  it('offers Resume for a paused listing', () => {
    renderScreen({ ...LISTING, status: 'paused' });
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });

  it("saves the changes then redirects to the product's storefront", async () => {
    updateListing.mockResolvedValueOnce({ ok: true, data: { _id: 'L1' } });
    renderScreen(LISTING);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Updated title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/stores/SF1?tab=products'));
    expect(updateListing).toHaveBeenCalledWith(
      'L1',
      expect.objectContaining({ title: 'Updated title', category: 'weaving' }),
    );
  });
});
