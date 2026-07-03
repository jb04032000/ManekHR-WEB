import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';

const { push, pathname } = vi.hoisted(() => ({ push: vi.fn(), pathname: { value: '/connect' } }));
// usePathname drives the contextual "See all" scope (Marketplace -> Products,
// Jobs -> Jobs). `pathname.value` is mutated per-test to exercise each route.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname.value,
}));

// The bar is a federated typeahead (SRCH-A11Y-1): it fires `searchConnectAll`
// (people + listings + posts, the same federated endpoint the mobile sheet and
// the results page use) and `searchTags` (tag autocomplete) as the member types,
// debounced. Mocked so no real network call happens.
const searchConnectAll = vi.fn();
const searchTags = vi.fn();
vi.mock('@/features/connect/search.actions', () => ({
  searchConnectAll: (...a: unknown[]) => searchConnectAll(...a),
  searchTags: (...a: unknown[]) => searchTags(...a),
}));

import ConnectSearchBar from './ConnectSearchBar';
import type {
  ConnectListingRef,
  ConnectTagView,
  PageResult,
  PersonResult,
  PostResult,
  SearchResponse,
  StorefrontResult,
} from '@/features/connect/search.types';
import type { Job } from '@/features/connect/jobs/jobs.types';

const zariTag: ConnectTagView = {
  slug: 'zari',
  labels: { en: 'Zari' },
  category: 'generic',
  usageCount: 42,
  trendingScore: 7.3,
};

const meera: PersonResult = {
  userId: 'u-meera',
  name: 'Meera Sharma',
  avatar: null,
  headline: 'Master zari karigar',
};

const sareeListing: ConnectListingRef = {
  listingId: 'l-saree',
  ownerUserId: 'u-shop',
  title: 'Banarasi zari saree',
  description: 'Hand-woven',
  category: 'embroidery-zari',
  priceType: 'fixed',
  priceMin: 4500,
  priceMax: null,
  unit: 'per-piece',
  district: 'Surat',
  coverImage: null,
  verified: true,
  createdAt: '2026-05-01T00:00:00.000Z',
};

const zariPost: PostResult = {
  postId: 'p-zari',
  authorId: 'u-meera',
  author: meera,
  snippet: 'Fresh zari work off the loom today',
  kind: 'photo',
  coverImage: null,
  reactionCount: 3,
  commentCount: 1,
  createdAt: '2026-05-02T00:00:00.000Z',
};

// Minimal job hit - the federated `jobs` vertical. Only the fields the
// dropdown row reads (`_id`, `title`, `location.district`) need to be real; the
// rest satisfy the `Job` type.
const karigarJob = {
  _id: 'j-karigar',
  companyUserId: 'u-shop',
  companyPageId: null,
  title: 'Zari karigar wanted',
  description: 'Skilled hands',
  responsibilities: [],
  category: 'embroidery-zari',
  role: 'karigar',
  wageType: 'monthly',
  wageMin: 18000,
  wageMax: 25000,
  openings: 3,
  location: { district: 'Surat' },
  skills: [],
  machineType: '',
  employmentType: 'full_time',
  experienceMin: null,
  shift: 'day',
  workingDays: 'Mon-Sat',
  languages: [],
  benefits: [],
  closesAt: null,
  status: 'open',
  applicationsCount: 0,
  views: 0,
  boostCampaignId: null,
} as unknown as Job;

// SRCH-VERT-1: storefront + page typeahead fixtures.
const zariStore: StorefrontResult = {
  storefrontId: 's-meera',
  ownerUserId: 'u-meera',
  name: 'Meera Zari House',
  slug: 'meera-zari-house',
  logo: null,
  description: 'Hand zari',
  categories: ['embroidery'],
  district: 'Surat',
  createdAt: '2026-05-03T00:00:00.000Z',
};

const institutePage: PageResult = {
  pageId: 'pg-academy',
  ownerUserId: 'u-acad',
  name: 'Surat Zari Academy',
  slug: 'surat-zari-academy',
  kind: 'institute',
  logo: null,
  about: 'Training karigars',
  district: 'Surat',
  createdAt: '2026-05-03T00:00:00.000Z',
};

/** Build a federated envelope with optional per-vertical results. */
function envelope(over: Partial<SearchResponse> = {}): { ok: true; data: SearchResponse } {
  return {
    ok: true,
    data: {
      results: [],
      posts: [],
      listings: [],
      jobs: [],
      // SRCH-VERT-1: the two new public verticals default empty.
      storefronts: [],
      pages: [],
      type: 'all',
      query: { raw: '', text: '', tags: [] },
      groups: [],
      ...over,
    },
  };
}

describe('ConnectSearchBar (federated + a11y — SRCH-A11Y-1)', () => {
  beforeEach(() => {
    push.mockClear();
    pathname.value = '/connect';
    searchConnectAll.mockReset();
    searchTags.mockReset();
    searchConnectAll.mockResolvedValue(envelope());
    searchTags.mockResolvedValue({ ok: true, data: [] });
  });

  it('seeds the input with the initial query', () => {
    renderWithIntl(<ConnectSearchBar initialQuery="zari work" />);
    // AntD AutoComplete exposes its input with the `combobox` role.
    expect(screen.getByRole('combobox')).toHaveValue('zari work');
  });

  it('runs a debounced FEDERATED search as the member types', async () => {
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'meera' } });
    // Typeahead always blends every vertical (type: 'all'), independent of route.
    await waitFor(() => expect(searchConnectAll).toHaveBeenCalledWith({ q: 'meera', type: 'all' }));
  });

  it('does not search for a query under the minimum length', async () => {
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'm' } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(searchConnectAll).not.toHaveBeenCalled();
    expect(searchTags).not.toHaveBeenCalled();
  });

  it('fires the tag autocomplete in parallel with the federated search', async () => {
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zari' } });
    await waitFor(() => expect(searchTags).toHaveBeenCalledWith('zari'));
    expect(searchConnectAll).toHaveBeenCalledWith({ q: 'zari', type: 'all' });
  });

  it('renders a tag option in the dropdown when the autocomplete returns hits', async () => {
    searchTags.mockResolvedValue({ ok: true, data: [zariTag] });
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'za' } });
    expect(await screen.findByText('Zari')).toBeInTheDocument();
  });

  it('navigates to /connect/search?q=#slug&type=people when a tag option is selected', async () => {
    searchTags.mockResolvedValue({ ok: true, data: [zariTag] });
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'za' } });
    fireEvent.click(await screen.findByText('Zari'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/search?q=%23zari&type=people'));
  });

  it('navigates to /connect/u/[id] for a person option (regression)', async () => {
    searchConnectAll.mockResolvedValue(envelope({ results: [meera] }));
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'meera' } });
    fireEvent.click(await screen.findByText('Meera Sharma'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/u/u-meera'));
  });

  it('renders a LISTING option and navigates to the listing detail route', async () => {
    searchConnectAll.mockResolvedValue(envelope({ listings: [sareeListing] }));
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'saree' } });
    fireEvent.click(await screen.findByText('Banarasi zari saree'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/marketplace/listing/l-saree'));
  });

  it('renders a POST option and navigates to the post detail route', async () => {
    searchConnectAll.mockResolvedValue(envelope({ posts: [zariPost] }));
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zari' } });
    fireEvent.click(await screen.findByText('Fresh zari work off the loom today'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/posts/p-zari'));
  });

  it('renders a JOB option and navigates to the job detail route', async () => {
    searchConnectAll.mockResolvedValue(envelope({ jobs: [karigarJob] }));
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'karigar' } });
    fireEvent.click(await screen.findByText('Zari karigar wanted'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/jobs/j-karigar'));
  });

  // SRCH-VERT-1: storefront + page typeahead rows (slug-based deep-links).
  it('renders a STOREFRONT option and navigates to the public store route', async () => {
    searchConnectAll.mockResolvedValue(envelope({ storefronts: [zariStore] }));
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'meera' } });
    fireEvent.click(await screen.findByText('Meera Zari House'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/store/meera-zari-house'));
  });

  it('renders a PAGE option with an institute badge and navigates to the company route', async () => {
    searchConnectAll.mockResolvedValue(envelope({ pages: [institutePage] }));
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'academy' } });
    // The institute badge renders next to the page name.
    expect(await screen.findByText('Institute')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Surat Zari Academy'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/company/surat-zari-academy'));
  });

  // --- Contextual "See all" scope (search-context.ts) -----------------------

  it('See all carries no type on a neutral route (blended default)', async () => {
    pathname.value = '/connect';
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zari work' } });
    // The default-active "See all" row routes to the bare results page.
    fireEvent.click(await screen.findByText(/See all results/i));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/search?q=zari%20work'));
  });

  it('See all scopes to listings inside Marketplace', async () => {
    pathname.value = '/connect/marketplace';
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'saree' } });
    fireEvent.click(await screen.findByText(/See all results/i));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/search?q=saree&type=listings'));
  });

  it('See all scopes to jobs inside the Jobs board', async () => {
    pathname.value = '/connect/jobs';
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'karigar' } });
    fireEvent.click(await screen.findByText(/See all results/i));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/search?q=karigar&type=jobs'));
  });

  // --- WCAG-AA combobox (SRCH-A11Y-1 §2) ------------------------------------

  it('exposes the WCAG combobox pattern: combobox + listbox + option roles', async () => {
    searchConnectAll.mockResolvedValue(envelope({ results: [meera] }));
    renderWithIntl(<ConnectSearchBar />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'meera' } });
    await screen.findByText('Meera Sharma');
    // Once open the input carries the combobox contract: expanded + controls the
    // popup listbox (aria-controls is set only while the popup is open - WCAG).
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls');
    // The popup is a listbox whose id matches aria-controls, with option rows.
    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
    expect(input.getAttribute('aria-controls')).toBe(listbox?.id);
    expect(document.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
  });

  it('ArrowDown moves aria-activedescendant to the next option (keyboard nav)', async () => {
    searchConnectAll.mockResolvedValue(envelope({ results: [meera] }));
    renderWithIntl(<ConnectSearchBar />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'meera' } });
    await screen.findByText('Meera Sharma');
    const before = input.getAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 });
    await waitFor(() => {
      const after = input.getAttribute('aria-activedescendant');
      // Active descendant advances to a real option id (the highlighted row).
      expect(after).toBeTruthy();
      expect(after).not.toBe(before);
      expect(document.getElementById(after as string)).toHaveAttribute('role', 'option');
    });
  });

  it('announces the result count via an aria-live region (screen-reader support)', async () => {
    searchConnectAll.mockResolvedValue(envelope({ results: [meera] }));
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'meera' } });
    // The polite live region (role="status") announces "N results" once results load.
    const live = await screen.findByRole('status');
    await waitFor(() => expect(live).toHaveTextContent(/1 result/i));
  });

  it('announces "No results" via the live region when the search comes back empty', async () => {
    // Federated returns nothing; tag autocomplete also empty.
    renderWithIntl(<ConnectSearchBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzqzz' } });
    const live = await screen.findByRole('status');
    await waitFor(() => expect(live).toHaveTextContent(/no results/i));
  });
});
