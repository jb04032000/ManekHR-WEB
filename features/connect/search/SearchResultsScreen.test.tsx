import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type {
  ConnectListingRef,
  PageResult,
  PersonResult,
  SearchQueryEcho,
  StorefrontResult,
} from '../search.types';
import type { Job } from '../jobs/jobs.types';

/**
 * `SearchResultsScreen` itself calls `useRouter` (the error-state retry +
 * tag-chip removal), and the embedded `ModuleTabs` (S1.6.3) reads
 * `usePathname` + `useSearchParams` to compute tab hrefs. One shared mock
 * covers both.
 */
const { push, refresh, pathnameRef, searchParamsRef } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  pathnameRef: { current: '/connect/search' },
  searchParamsRef: { current: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => pathnameRef.current,
  useSearchParams: () => searchParamsRef.current,
}));

import SearchResultsScreen, { type SearchScreenState } from './SearchResultsScreen';

const RESULTS: PersonResult[] = [
  { userId: 'u1', name: 'Meera Sharma', avatar: null, headline: 'Master zari karigar' },
  { userId: 'u2', name: 'Vikas Soni', avatar: null, headline: 'Computerized embroidery' },
];

/**
 * Synthesize a minimal `SearchResponse`-shaped results state for tests. The
 * envelope's non-results fields (type, query, groups) are plumbed through the
 * state in S1.6.2 and consumed by tag chips + canonical echo in S1.6.3.
 */
const resultsState = (
  query: string,
  results: PersonResult[],
  queryEcho?: Partial<SearchQueryEcho>,
): SearchScreenState => ({
  kind: 'results',
  results,
  posts: [],
  listings: [],
  jobs: [],
  // SRCH-VERT-1: the two new public verticals default empty in the helper.
  storefronts: [],
  pages: [],
  // Default to the people-only vertical so existing assertions on the
  // legacy 'X people found' subtitle + person list keep passing. The
  // listings + 'all' branches have their own dedicated tests below.
  type: 'people',
  query: {
    raw: queryEcho?.raw ?? query,
    text: queryEcho?.text ?? query,
    tags: queryEcho?.tags ?? [],
  },
  groups: [{ type: 'people', results }],
});

describe('SearchResultsScreen', () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    pathnameRef.current = '/connect/search';
    searchParamsRef.current = new URLSearchParams();
  });

  it('prompts the member to search when there is no query', () => {
    renderWithIntl(<SearchResultsScreen query="" state={{ kind: 'no-query' }} />);
    expect(screen.getByText('Search Connect')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Type a name, a kind of work, a product, or a hashtag to search across Connect.',
      ),
    ).toBeInTheDocument();
  });

  it('lists every person result with name and headline', () => {
    renderWithIntl(<SearchResultsScreen query="zari" state={resultsState('zari', RESULTS)} />);
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
    expect(screen.getByText('Vikas Soni')).toBeInTheDocument();
    expect(screen.getByText('Master zari karigar')).toBeInTheDocument();
  });

  it('links each result to the in-app person profile at /connect/u/[userId]', () => {
    renderWithIntl(<SearchResultsScreen query="zari" state={resultsState('zari', RESULTS)} />);
    // PersonCard links both the avatar and the name to the in-app profile.
    // Every link for a person points at that person's `/connect/u/[userId]`.
    const meeraLinks = screen.getAllByRole('link', { name: 'Meera Sharma' });
    expect(meeraLinks.length).toBeGreaterThan(0);
    meeraLinks.forEach((link) => expect(link.getAttribute('href')).toBe('/connect/u/u1'));

    const vikasLinks = screen.getAllByRole('link', { name: 'Vikas Soni' });
    vikasLinks.forEach((link) => expect(link.getAttribute('href')).toBe('/connect/u/u2'));
  });

  it('shows the count and query in the subtitle for a non-empty result', () => {
    renderWithIntl(<SearchResultsScreen query="zari" state={resultsState('zari', RESULTS)} />);
    expect(screen.getByText('2 people found for "zari"')).toBeInTheDocument();
  });

  it('renders an empty state naming the query when a real search matched nobody', () => {
    renderWithIntl(<SearchResultsScreen query="xyzzy" state={resultsState('xyzzy', [])} />);
    // The zero-result branch now renders ZeroResultSuggestions (its headline names
    // the query); the legacy ConnectEmptyState copy was replaced by concurrent work.
    expect(screen.getByText('No results for "xyzzy"')).toBeInTheDocument();
  });

  it('renders a recoverable error state with a retry button', () => {
    renderWithIntl(<SearchResultsScreen query="zari" state={{ kind: 'error', message: 'boom' }} />);
    expect(screen.getByText('Search did not work')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Try again' });
    retry.click();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // S1.6.3 - tab strip, tag chips, canonical echo, coming-soon panel.
  // ---------------------------------------------------------------------------

  it('renders the type tab strip with all five verticals', () => {
    renderWithIntl(<SearchResultsScreen query="zari" state={resultsState('zari', RESULTS)} />);
    const tablist = screen.getByRole('tablist', { name: 'Search result categories' });
    expect(tablist).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Posts' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Listings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Jobs' })).toBeInTheDocument();
  });

  it('marks the active tab as aria-selected based on the URL ?type= param', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=people');
    renderWithIntl(<SearchResultsScreen query="zari" state={resultsState('zari', RESULTS)} />);
    expect(screen.getByRole('tab', { name: 'People' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'false');
  });

  it('renders a chip for every canonical tag in the query echo', () => {
    renderWithIntl(
      <SearchResultsScreen
        query="zari #moti"
        state={resultsState('zari #moti', RESULTS, {
          raw: 'zari #moti',
          text: 'zari moti',
          tags: ['moti'],
        })}
      />,
    );
    // The chip surfaces the slug as its label.
    expect(screen.getByText('#moti')).toBeInTheDocument();
    // Every chip carries a remove control labelled by the slug.
    expect(screen.getByRole('button', { name: 'Remove tag moti' })).toBeInTheDocument();
  });

  it('navigates with the hashtag stripped from q when a chip remove is clicked', () => {
    renderWithIntl(
      <SearchResultsScreen
        query="zari #moti"
        state={resultsState('zari #moti', RESULTS, {
          raw: 'zari #moti',
          text: 'zari moti',
          tags: ['moti'],
        })}
      />,
    );
    screen.getByRole('button', { name: 'Remove tag moti' }).click();
    expect(push).toHaveBeenCalledTimes(1);
    const target = push.mock.calls[0]?.[0] as string;
    // The new URL stays on the same page, drops the `#moti` token from q, and
    // keeps the path intact. `q=zari` is the only required state.
    expect(target.startsWith('/connect/search')).toBe(true);
    const params = new URLSearchParams(target.split('?')[1] ?? '');
    expect(params.get('q')).toBe('zari');
  });

  it('shows the canonical echo only when query.text differs from query.raw', () => {
    renderWithIntl(
      <SearchResultsScreen
        query="#zardozi"
        state={resultsState('#zardozi', RESULTS, {
          raw: '#zardozi',
          text: 'zari',
          tags: ['zari'],
        })}
      />,
    );
    expect(screen.getByText('Showing results for "zari"')).toBeInTheDocument();
  });

  it('hides the canonical echo when query.text matches query.raw', () => {
    renderWithIntl(<SearchResultsScreen query="zari" state={resultsState('zari', RESULTS)} />);
    expect(screen.queryByText(/Showing results for/)).not.toBeInTheDocument();
  });

  // Phase 5 - jobs vertical now has a live backend index; the jobs tab renders
  // real job cards (no more Coming Soon placeholder).

  const JOBS: Job[] = [
    {
      _id: 'J1',
      companyUserId: 'u-rajesh',
      companyPageId: 'page-rajesh',
      title: 'Zari embroidery karigar wanted',
      description: 'Daily wage work at a Surat workshop',
      category: 'embroidery-zari',
      // Fields added to the Job type since this fixture was written (structured
      // detail + employment terms). Empty/unspecified defaults keep the card
      // render under test unchanged; they exist only to satisfy the Job contract.
      responsibilities: [],
      wageType: 'daily',
      wageMin: 500,
      wageMax: 700,
      openings: 2,
      location: { district: 'Surat', city: '', state: 'Gujarat' },
      skills: ['Zari', 'Hand embroidery'],
      machineType: '',
      employmentType: null,
      experienceMin: null,
      shift: null,
      workingDays: '',
      languages: [],
      benefits: [],
      closesAt: null,
      status: 'open',
      applicationsCount: 0,
      views: 0,
      role: 'karigar',
      boostCampaignId: null,
      createdAt: '2026-05-29T10:00:00.000Z',
    },
  ];

  it('renders one JobCard per job on the jobs tab', () => {
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: [],
          jobs: JOBS,
          storefronts: [],
          pages: [],
          type: 'jobs',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'jobs', results: JOBS }],
        }}
      />,
    );
    const card = screen.getByRole('link', { name: /Zari embroidery karigar wanted/ });
    expect(card).toBeInTheDocument();
    expect(card.getAttribute('href')).toBe('/connect/jobs/J1');
    expect(screen.getByText('1 job found for "zari"')).toBeInTheDocument();
  });

  it('renders the jobs empty state when no jobs match', () => {
    renderWithIntl(
      <SearchResultsScreen
        query="xyzzy"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: [],
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'jobs',
          query: { raw: 'xyzzy', text: 'xyzzy', tags: [] },
          groups: [{ type: 'jobs', results: [] }],
        }}
      />,
    );
    // Zero-result branch -> ZeroResultSuggestions (headline names the query).
    expect(screen.getByText('No results for "xyzzy"')).toBeInTheDocument();
  });

  it('shows the jobs facet panel on the jobs tab', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=jobs');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: [],
          jobs: JOBS,
          storefronts: [],
          pages: [],
          type: 'jobs',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'jobs', results: JOBS }],
        }}
      />,
    );
    // The category pills are present; the people facets are not.
    expect(screen.getByRole('button', { name: 'Weaving' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Skills')).not.toBeInTheDocument();
  });

  // M1.4.3 - listings vertical + all-tab fan-out rendering.

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

  it('renders one ListingCard per listing on the listings tab', () => {
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: LISTINGS,
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'listings',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'listings', results: LISTINGS }],
        }}
      />,
    );
    expect(screen.getByText('Heavy zari saree work')).toBeInTheDocument();
    expect(screen.getByText('Embroidery and Zari')).toBeInTheDocument();
    expect(screen.getByText('View product')).toBeInTheDocument();
    // The card's "View product" link points at the listing detail page.
    const productLink = screen.getByRole('link', { name: 'View product' });
    expect(productLink.getAttribute('href')).toBe('/connect/marketplace/listing/L1');
  });

  it('renders the listings empty state when no listings match', () => {
    renderWithIntl(
      <SearchResultsScreen
        query="xyzzy"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: [],
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'listings',
          query: { raw: 'xyzzy', text: 'xyzzy', tags: [] },
          groups: [{ type: 'listings', results: [] }],
        }}
      />,
    );
    // Zero-result branch -> ZeroResultSuggestions (headline names the query).
    expect(screen.getByText('No results for "xyzzy"')).toBeInTheDocument();
  });

  it('renders both People and Listings sections on the all tab', () => {
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: RESULTS,
          posts: [],
          listings: LISTINGS,
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'all',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [
            { type: 'people', results: RESULTS },
            { type: 'listings', results: LISTINGS },
          ],
        }}
      />,
    );
    // Section headers visible.
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Listings' })).toBeInTheDocument();
    // Both sections render their content.
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
    expect(screen.getByText('Heavy zari saree work')).toBeInTheDocument();
  });

  // Progressive loading ADR - Phase 1: listings-tab infinite scroll. The
  // sentinel (its "loading more" copy) renders only while the leak-free
  // listingsTotal exceeds the rows already loaded.

  it('shows the load-more sentinel on the listings tab when more pages remain', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=listings');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: LISTINGS,
          // Far more matches than the one row on page 1 -> hasMore is true.
          listingsTotal: 50,
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'listings',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'listings', results: LISTINGS }],
        }}
        searchInput={{ q: 'zari', type: 'listings' }}
        pageSize={24}
      />,
    );
    expect(screen.getByText('Loading more listings...')).toBeInTheDocument();
  });

  it('hides the load-more sentinel on the listings tab when every row is loaded', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=listings');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: LISTINGS,
          // Total equals the loaded count -> no more pages, no sentinel.
          listingsTotal: LISTINGS.length,
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'listings',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'listings', results: LISTINGS }],
        }}
        searchInput={{ q: 'zari', type: 'listings' }}
        pageSize={24}
      />,
    );
    expect(screen.queryByText('Loading more listings...')).not.toBeInTheDocument();
  });

  // Progressive loading ADR - Phase 1b: a "Show all" jump under each non-empty
  // blended-view section switches ?type=<vertical> (preview -> focused tab).

  it('renders a per-section "Show all" jump in the blended all view', () => {
    searchParamsRef.current = new URLSearchParams('q=zari');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: RESULTS,
          posts: [],
          listings: LISTINGS,
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'all',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [
            { type: 'people', results: RESULTS },
            { type: 'listings', results: LISTINGS },
          ],
        }}
      />,
    );
    // Each non-empty section gets a distinct, leak-free jump to its focused tab.
    const peopleJump = screen.getByRole('link', { name: 'Show all People' });
    expect(peopleJump.getAttribute('href')).toBe('/connect/search?q=zari&type=people');
    const listingsJump = screen.getByRole('link', { name: 'Show all Listings' });
    expect(listingsJump.getAttribute('href')).toBe('/connect/search?q=zari&type=listings');
    // Empty sections (posts here) get no jump link.
    expect(screen.queryByRole('link', { name: 'Show all Posts' })).not.toBeInTheDocument();
  });

  // Progressive loading ADR - Phase 2: people-tab infinite scroll. The sentinel
  // (its "loading more people" copy) renders only while the leak-free peopleTotal
  // exceeds the rows already loaded - mirrors the Phase-1 listings sentinel.

  it('shows the load-more sentinel on the people tab when more pages remain', () => {
    searchParamsRef.current = new URLSearchParams('q=meera&type=people');
    renderWithIntl(
      <SearchResultsScreen
        query="meera"
        state={{
          kind: 'results',
          results: RESULTS,
          posts: [],
          listings: [],
          listingsTotal: 0,
          // Far more matches than the rows on page 1 -> hasMore is true.
          peopleTotal: 50,
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'people',
          query: { raw: 'meera', text: 'meera', tags: [] },
          groups: [{ type: 'people', results: RESULTS }],
        }}
        searchInput={{ q: 'meera', type: 'people' }}
        pageSize={24}
      />,
    );
    expect(screen.getByText('Loading more people...')).toBeInTheDocument();
  });

  it('hides the load-more sentinel on the people tab when every row is loaded', () => {
    searchParamsRef.current = new URLSearchParams('q=meera&type=people');
    renderWithIntl(
      <SearchResultsScreen
        query="meera"
        state={{
          kind: 'results',
          results: RESULTS,
          posts: [],
          listings: [],
          listingsTotal: 0,
          // Total equals the loaded count -> no more pages, no sentinel.
          peopleTotal: RESULTS.length,
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'people',
          query: { raw: 'meera', text: 'meera', tags: [] },
          groups: [{ type: 'people', results: RESULTS }],
        }}
        searchInput={{ q: 'meera', type: 'people' }}
        pageSize={24}
      />,
    );
    expect(screen.queryByText('Loading more people...')).not.toBeInTheDocument();
  });

  // Progressive loading ADR - Phase 3: posts-tab infinite scroll. Same sentinel
  // pattern as people/listings, driven by the leak-free postsTotal.
  const SENTINEL_POSTS = [
    {
      postId: 'p1',
      authorId: 'u-meera',
      author: { userId: 'u-meera', name: 'Meera Sharma', avatar: null, headline: 'Karigar' },
      snippet: 'Heavy zari work in progress',
      kind: 'text' as const,
      coverImage: null,
      reactionCount: 3,
      commentCount: 1,
      createdAt: '2026-05-30T10:00:00.000Z',
    },
  ];

  it('shows the load-more sentinel on the posts tab when more pages remain', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=posts');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: SENTINEL_POSTS,
          listings: [],
          listingsTotal: 0,
          peopleTotal: 0,
          // Far more matches than the rows on page 1 -> hasMore is true.
          postsTotal: 50,
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'posts',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'posts', results: SENTINEL_POSTS }],
        }}
        searchInput={{ q: 'zari', type: 'posts' }}
        pageSize={24}
      />,
    );
    expect(screen.getByText('Loading more posts...')).toBeInTheDocument();
  });

  it('hides the load-more sentinel on the posts tab when every row is loaded', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=posts');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: SENTINEL_POSTS,
          listings: [],
          listingsTotal: 0,
          peopleTotal: 0,
          // Total equals the loaded count -> no more pages, no sentinel.
          postsTotal: SENTINEL_POSTS.length,
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'posts',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'posts', results: SENTINEL_POSTS }],
        }}
        searchInput={{ q: 'zari', type: 'posts' }}
        pageSize={24}
      />,
    );
    expect(screen.queryByText('Loading more posts...')).not.toBeInTheDocument();
  });

  // Progressive loading ADR - Phase 3: jobs-tab infinite scroll. Same sentinel
  // pattern as posts/people/listings, driven by the leak-free jobsTotal.
  it('shows the load-more sentinel on the jobs tab when more pages remain', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=jobs');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: [],
          listingsTotal: 0,
          peopleTotal: 0,
          postsTotal: 0,
          // Far more matches than the rows on page 1 -> hasMore is true.
          jobsTotal: 50,
          jobs: JOBS,
          storefronts: [],
          pages: [],
          type: 'jobs',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'jobs', results: JOBS }],
        }}
        searchInput={{ q: 'zari', type: 'jobs' }}
        pageSize={24}
      />,
    );
    expect(screen.getByText('Loading more jobs...')).toBeInTheDocument();
  });

  it('hides the load-more sentinel on the jobs tab when every row is loaded', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=jobs');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: [],
          listingsTotal: 0,
          peopleTotal: 0,
          postsTotal: 0,
          // Total equals the loaded count -> no more pages, no sentinel.
          jobsTotal: JOBS.length,
          jobs: JOBS,
          storefronts: [],
          pages: [],
          type: 'jobs',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'jobs', results: JOBS }],
        }}
        searchInput={{ q: 'zari', type: 'jobs' }}
        pageSize={24}
      />,
    );
    expect(screen.queryByText('Loading more jobs...')).not.toBeInTheDocument();
  });

  // Progressive loading ADR - Phase 3: storefronts-tab infinite scroll.
  const SENTINEL_STORES = [
    {
      storefrontId: 's1',
      ownerUserId: 'u-shop',
      name: 'Meera Zari House',
      slug: 'meera-zari-house',
      logo: null,
      description: 'Hand zari',
      categories: ['embroidery'],
      district: 'Surat',
      createdAt: '2026-05-03T00:00:00.000Z',
    },
  ];

  it('shows the load-more sentinel on the storefronts tab when more pages remain', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=storefronts');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: [],
          listingsTotal: 0,
          peopleTotal: 0,
          postsTotal: 0,
          jobsTotal: 0,
          // Far more matches than the rows on page 1 -> hasMore is true.
          storefrontsTotal: 50,
          jobs: [],
          storefronts: SENTINEL_STORES,
          pages: [],
          type: 'storefronts',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'storefronts', results: SENTINEL_STORES }],
        }}
        searchInput={{ q: 'zari', type: 'storefronts' }}
        pageSize={24}
      />,
    );
    expect(screen.getByText('Loading more shops...')).toBeInTheDocument();
  });

  it('hides the load-more sentinel on the storefronts tab when every row is loaded', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=storefronts');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: [],
          listingsTotal: 0,
          peopleTotal: 0,
          postsTotal: 0,
          jobsTotal: 0,
          // Total equals the loaded count -> no more pages, no sentinel.
          storefrontsTotal: SENTINEL_STORES.length,
          jobs: [],
          storefronts: SENTINEL_STORES,
          pages: [],
          type: 'storefronts',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'storefronts', results: SENTINEL_STORES }],
        }}
        searchInput={{ q: 'zari', type: 'storefronts' }}
        pageSize={24}
      />,
    );
    expect(screen.queryByText('Loading more shops...')).not.toBeInTheDocument();
  });

  // Progressive loading ADR - Phase 3: pages-tab infinite scroll (the LAST vertical).
  const SENTINEL_PAGES = [
    {
      pageId: 'pg1',
      ownerUserId: 'u-acad',
      name: 'Surat Zari Academy',
      slug: 'surat-zari-academy',
      kind: 'institute' as const,
      logo: null,
      about: 'Training karigars',
      district: 'Surat',
      createdAt: '2026-05-03T00:00:00.000Z',
    },
  ];

  it('shows the load-more sentinel on the pages tab when more pages remain', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=pages');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: [],
          listingsTotal: 0,
          peopleTotal: 0,
          postsTotal: 0,
          jobsTotal: 0,
          storefrontsTotal: 0,
          // Far more matches than the rows on page 1 -> hasMore is true.
          pagesTotal: 50,
          jobs: [],
          storefronts: [],
          pages: SENTINEL_PAGES,
          type: 'pages',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'pages', results: SENTINEL_PAGES }],
        }}
        searchInput={{ q: 'zari', type: 'pages' }}
        pageSize={24}
      />,
    );
    expect(screen.getByText('Loading more pages...')).toBeInTheDocument();
  });

  it('hides the load-more sentinel on the pages tab when every row is loaded', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=pages');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: [],
          listingsTotal: 0,
          peopleTotal: 0,
          postsTotal: 0,
          jobsTotal: 0,
          storefrontsTotal: 0,
          // Total equals the loaded count -> no more pages, no sentinel.
          pagesTotal: SENTINEL_PAGES.length,
          jobs: [],
          storefronts: [],
          pages: SENTINEL_PAGES,
          type: 'pages',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'pages', results: SENTINEL_PAGES }],
        }}
        searchInput={{ q: 'zari', type: 'pages' }}
        pageSize={24}
      />,
    );
    expect(screen.queryByText('Loading more pages...')).not.toBeInTheDocument();
  });

  it('renders post results on the posts tab (search redesign Phase C)', () => {
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [
            {
              postId: 'p1',
              authorId: 'u-meera',
              author: {
                userId: 'u-meera',
                name: 'Meera Sharma',
                avatar: null,
                headline: 'Karigar',
              },
              snippet: 'Heavy zari work in progress',
              kind: 'text',
              coverImage: null,
              reactionCount: 3,
              commentCount: 1,
              createdAt: '2026-05-30T10:00:00.000Z',
            },
          ],
          listings: [],
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'posts',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'posts', results: [] }],
        }}
      />,
    );
    expect(screen.getByText('Heavy zari work in progress')).toBeInTheDocument();
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Post by Meera Sharma' });
    expect(link.getAttribute('href')).toBe('/connect/posts/p1');
  });

  // M1.6.6 - the listings tab swaps the people facets for the listings facets.

  it('shows the listings facet panel (not the people facets) on the listings tab', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=listings');
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: [],
          posts: [],
          listings: LISTINGS,
          jobs: [],
          storefronts: [],
          pages: [],
          type: 'listings',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [{ type: 'listings', results: LISTINGS }],
        }}
      />,
    );
    // The listings facets are present. Category pills moved to the marketplace
    // CategoryStrip (M1.6.x), so the panel marker is now its Price range control,
    // which is unique to the listings panel (the people facets have no price).
    expect(screen.getByText('Price range')).toBeInTheDocument();
    // ...the people facets are gone...
    expect(screen.queryByLabelText('Skills')).not.toBeInTheDocument();
    // ...and the keyword field is hidden (the header search bar owns q here).
    expect(screen.queryByLabelText('Search listings')).not.toBeInTheDocument();
  });

  it('shows the people facet panel on the people tab', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=people');
    renderWithIntl(<SearchResultsScreen query="zari" state={resultsState('zari', RESULTS)} />);
    expect(screen.getByLabelText('Skills')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Weaving' })).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // SRCH-VERT-1 - storefronts + pages (company/institute) verticals.
  // ---------------------------------------------------------------------------

  const STORES: StorefrontResult[] = [
    {
      storefrontId: 'S1',
      ownerUserId: 'u-meera',
      name: 'Meera Zari House',
      slug: 'meera-zari-house',
      logo: null,
      description: 'Hand zari since 1998',
      categories: ['embroidery', 'sarees'],
      district: 'Surat',
      createdAt: '2026-05-20T10:00:00.000Z',
    },
  ];

  const PAGES: PageResult[] = [
    {
      pageId: 'P1',
      ownerUserId: 'u-acad',
      name: 'Surat Zari Academy',
      slug: 'surat-zari-academy',
      kind: 'institute',
      logo: null,
      about: 'Training karigars',
      district: 'Surat',
      createdAt: '2026-05-20T10:00:00.000Z',
    },
    {
      pageId: 'P2',
      ownerUserId: 'u-biz',
      name: 'Rajesh Textiles',
      slug: 'rajesh-textiles',
      kind: 'business',
      logo: null,
      about: null,
      district: 'Surat',
      createdAt: '2026-05-20T10:00:00.000Z',
    },
  ];

  const storeState = (stores: StorefrontResult[]): SearchScreenState => ({
    kind: 'results',
    results: [],
    posts: [],
    listings: [],
    jobs: [],
    storefronts: stores,
    pages: [],
    type: 'storefronts',
    query: { raw: 'zari', text: 'zari', tags: [] },
    groups: [{ type: 'storefronts', results: stores }],
  });

  const pageState = (pages: PageResult[]): SearchScreenState => ({
    kind: 'results',
    results: [],
    posts: [],
    listings: [],
    jobs: [],
    storefronts: [],
    pages,
    type: 'pages',
    query: { raw: 'zari', text: 'zari', tags: [] },
    groups: [{ type: 'pages', results: pages }],
  });

  it('renders the Stores and Pages tabs in the strip', () => {
    renderWithIntl(<SearchResultsScreen query="zari" state={resultsState('zari', RESULTS)} />);
    expect(screen.getByRole('tab', { name: /Stores/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Pages/ })).toBeInTheDocument();
  });

  it('links each storefront row to /connect/store/[slug] on the storefronts tab', () => {
    renderWithIntl(<SearchResultsScreen query="zari" state={storeState(STORES)} />);
    const link = screen.getByRole('link', { name: 'Store: Meera Zari House' });
    expect(link.getAttribute('href')).toBe('/connect/store/meera-zari-house');
    expect(screen.getByText('1 store found for "zari"')).toBeInTheDocument();
  });

  it('renders the storefronts empty state when no stores match', () => {
    renderWithIntl(<SearchResultsScreen query="xyzzy" state={storeState([])} />);
    expect(screen.getByText('No stores found for "xyzzy".')).toBeInTheDocument();
  });

  it('links each page row to /connect/company/[slug] and badges institutes', () => {
    renderWithIntl(<SearchResultsScreen query="zari" state={pageState(PAGES)} />);
    const academy = screen.getByRole('link', { name: 'Page: Surat Zari Academy' });
    expect(academy.getAttribute('href')).toBe('/connect/company/surat-zari-academy');
    const business = screen.getByRole('link', { name: 'Page: Rajesh Textiles' });
    expect(business.getAttribute('href')).toBe('/connect/company/rajesh-textiles');
    // The institute page carries the Institute badge; the business page does not.
    const badges = screen.getAllByText('Institute');
    expect(badges.length).toBe(1);
    expect(screen.getByText('2 pages found for "zari"')).toBeInTheDocument();
  });

  it('shows the pageKind (business/institute) pills on the pages tab', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=pages');
    renderWithIntl(<SearchResultsScreen query="zari" state={pageState(PAGES)} />);
    expect(screen.getByRole('button', { name: 'Institute' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Business' })).toBeInTheDocument();
    // The people facets are not present on the pages tab.
    expect(screen.queryByLabelText('Skills')).not.toBeInTheDocument();
  });

  it('hides the pageKind pills on the storefronts tab (district facet only)', () => {
    searchParamsRef.current = new URLSearchParams('q=zari&type=storefronts');
    renderWithIntl(<SearchResultsScreen query="zari" state={storeState(STORES)} />);
    // Storefronts have no kind, so the business/institute pills are not shown...
    expect(screen.queryByRole('button', { name: 'Institute' })).not.toBeInTheDocument();
    // ...but the shared district facet is present.
    expect(screen.getByLabelText('District')).toBeInTheDocument();
  });

  it('renders Stores and Pages sections in the blended all view', () => {
    renderWithIntl(
      <SearchResultsScreen
        query="zari"
        state={{
          kind: 'results',
          results: RESULTS,
          posts: [],
          listings: [],
          jobs: [],
          storefronts: STORES,
          pages: PAGES,
          type: 'all',
          query: { raw: 'zari', text: 'zari', tags: [] },
          groups: [
            { type: 'people', results: RESULTS },
            { type: 'storefronts', results: STORES },
            { type: 'pages', results: PAGES },
          ],
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Stores' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pages' })).toBeInTheDocument();
    expect(screen.getByText('Meera Zari House')).toBeInTheDocument();
    expect(screen.getByText('Surat Zari Academy')).toBeInTheDocument();
  });
});
