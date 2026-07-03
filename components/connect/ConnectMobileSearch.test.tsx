import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, fireEvent } from '@/test-utils/render';
import type {
  ConnectListingRef,
  PersonResult,
  PostResult,
  SearchResponse,
} from '@/features/connect/search.types';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// The overlay typeahead fires `searchConnectAll` (federated) as the member
// types, debounced. `searchConnect` is mocked too because the pre-parity
// component imported it; mocking both keeps the module shape stable across the
// change and avoids an undefined-import error.
const searchConnect = vi.fn();
const searchConnectAll = vi.fn();
vi.mock('@/features/connect/search.actions', () => ({
  searchConnect: (...a: unknown[]) => searchConnect(...a),
  searchConnectAll: (...a: unknown[]) => searchConnectAll(...a),
}));

import ConnectMobileSearch from './ConnectMobileSearch';

const meera: PersonResult = {
  userId: 'u-meera',
  name: 'Meera Sharma',
  avatar: null,
  headline: 'Master zari karigar',
};

const anand: PersonResult = {
  userId: 'u-anand',
  name: 'Anand Patel',
  avatar: null,
  headline: null,
};

const listing: ConnectListingRef = {
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

const post: PostResult = {
  postId: 'p1',
  authorId: 'u-anand',
  author: anand,
  snippet: 'New zari designs in stock now',
  kind: 'text',
  coverImage: null,
  reactionCount: 3,
  commentCount: 1,
  createdAt: '2026-05-28T12:00:00.000Z',
};

function envelope(partial: Partial<SearchResponse>): SearchResponse {
  return {
    results: [],
    posts: [],
    listings: [],
    jobs: [],
    // SRCH-VERT-1: the two new public verticals default empty.
    storefronts: [],
    pages: [],
    type: 'all',
    query: { raw: 'zari', text: 'zari', tags: [] },
    groups: [],
    ...partial,
  };
}

function type(value: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
}

describe('ConnectMobileSearch (blended typeahead, Phase D)', () => {
  beforeEach(() => {
    push.mockClear();
    searchConnect.mockReset();
    searchConnectAll.mockReset();
    searchConnect.mockResolvedValue({ ok: true, data: [] });
    searchConnectAll.mockResolvedValue({ ok: true, data: envelope({}) });
  });

  it('runs the federated search as the member types', async () => {
    searchConnectAll.mockResolvedValue({ ok: true, data: envelope({ results: [meera] }) });
    renderWithIntl(<ConnectMobileSearch open onClose={() => {}} />);
    type('zari');
    expect(await screen.findByText('Meera Sharma')).toBeInTheDocument();
    expect(searchConnectAll).toHaveBeenCalledWith({ q: 'zari' });
  });

  it('shows blended People, Posts and Listings sections', async () => {
    searchConnectAll.mockResolvedValue({
      ok: true,
      data: envelope({ results: [meera], posts: [post], listings: [listing] }),
    });
    renderWithIntl(<ConnectMobileSearch open onClose={() => {}} />);
    type('zari');
    expect(await screen.findByText('People')).toBeInTheDocument();
    expect(screen.getByText('Posts')).toBeInTheDocument();
    expect(screen.getByText('Listings')).toBeInTheDocument();
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
    expect(screen.getByText('Heavy zari saree work')).toBeInTheDocument();
    expect(screen.getByText('New zari designs in stock now')).toBeInTheDocument();
  });

  it('omits a vertical that returned no hits', async () => {
    searchConnectAll.mockResolvedValue({ ok: true, data: envelope({ results: [meera] }) });
    renderWithIntl(<ConnectMobileSearch open onClose={() => {}} />);
    type('zari');
    expect(await screen.findByText('People')).toBeInTheDocument();
    expect(screen.queryByText('Posts')).not.toBeInTheDocument();
    expect(screen.queryByText('Listings')).not.toBeInTheDocument();
  });

  it('routes to the listing detail when a listing row is tapped', async () => {
    searchConnectAll.mockResolvedValue({ ok: true, data: envelope({ listings: [listing] }) });
    renderWithIntl(<ConnectMobileSearch open onClose={() => {}} />);
    type('zari');
    fireEvent.click(await screen.findByText('Heavy zari saree work'));
    expect(push).toHaveBeenCalledWith('/connect/marketplace/listing/L1');
  });

  it('routes to the post when a post row is tapped', async () => {
    searchConnectAll.mockResolvedValue({ ok: true, data: envelope({ posts: [post] }) });
    renderWithIntl(<ConnectMobileSearch open onClose={() => {}} />);
    type('zari');
    fireEvent.click(await screen.findByText('New zari designs in stock now'));
    expect(push).toHaveBeenCalledWith('/connect/posts/p1');
  });

  it('still routes to the profile when a person row is tapped', async () => {
    searchConnectAll.mockResolvedValue({ ok: true, data: envelope({ results: [meera] }) });
    renderWithIntl(<ConnectMobileSearch open onClose={() => {}} />);
    type('zari');
    fireEvent.click(await screen.findByText('Meera Sharma'));
    expect(push).toHaveBeenCalledWith('/connect/u/u-meera');
  });

  it('keeps the See all results row routing to the full search page', async () => {
    renderWithIntl(<ConnectMobileSearch open onClose={() => {}} />);
    type('zari');
    fireEvent.click(await screen.findByText('See all results for "zari"'));
    expect(push).toHaveBeenCalledWith('/connect/search?q=zari');
  });
});
