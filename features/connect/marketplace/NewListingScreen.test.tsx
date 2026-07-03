import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';

/**
 * M1.6.3 - NewListingScreen (the seller create-listing form).
 *
 * The form posts through the mocked `createListing` action. `MediaUploadGrid`
 * is stubbed so the test never touches the R2 upload service. Required-field
 * validation is AntD Form's job (the action must not fire when title is blank);
 * the soft listing-cap prompt names the plan limit rather than hard-failing.
 */
const { push, refresh, pathnameRef, searchParamsRef } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  pathnameRef: { current: '/connect/marketplace/new' },
  searchParamsRef: { current: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => pathnameRef.current,
  useSearchParams: () => searchParamsRef.current,
}));
const { createListing } = vi.hoisted(() => ({ createListing: vi.fn() }));
vi.mock('./marketplace.actions', () => ({ createListing }));
vi.mock('../entities/collection.actions', () => ({
  setListingCollections: vi.fn(async () => ({ ok: true, data: { collectionIds: [] } })),
  createCollection: vi.fn(async () => ({ ok: true, data: { _id: 'c-new', title: 'New' } })),
}));
vi.mock('@/components/connect/MediaUploadGrid', () => ({
  default: ({ onChange }: { onChange: (urls: string[]) => void }) => (
    <button type="button" onClick={() => onChange(['https://img/1.jpg'])}>
      mock-upload
    </button>
  ),
}));

import { App as AntApp } from 'antd';
import NewListingScreen from './NewListingScreen';

// The Connect shell wraps pages in AntD's <App> (for message/notification
// context); mirror that here so the success toast has a host.
const renderScreen = (ui = <NewListingScreen />) => renderWithIntl(<AntApp>{ui}</AntApp>);

beforeEach(() => {
  createListing.mockReset();
});

describe('NewListingScreen', () => {
  it('renders the required title + category fields and the submit button', () => {
    renderScreen();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Weaving' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish listing' })).toBeInTheDocument();
  });

  it('does not call the action when the required title is missing', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Publish listing' }));
    expect(createListing).not.toHaveBeenCalled();
  });

  it('submits the payload then redirects to the product listing page', async () => {
    createListing.mockResolvedValueOnce({
      ok: true,
      data: { _id: 'L9', title: 'Heavy zari work' },
    });
    renderScreen();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Heavy zari work' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Weaving' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish listing' }));
    // No shop context -> lands on the cross-shop "My listings" page.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/marketplace/mine'));
    expect(createListing).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Heavy zari work', category: 'weaving' }),
    );
  });

  it('shows the shared limit dialog when the listing cap is reached', async () => {
    createListing.mockResolvedValueOnce({
      ok: false,
      code: 'CONNECT_LIMIT_REACHED',
      error: 'full',
      limitReached: { kind: 'listing', limit: 25, used: 25 },
    });
    renderScreen();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Another listing' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Weaving' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish listing' }));
    expect(await screen.findByText('You have reached your limit')).toBeInTheDocument();
    expect(screen.getByText('You have used 25 of 25 products.')).toBeInTheDocument();
  });
});
